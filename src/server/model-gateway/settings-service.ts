import { z } from "zod";

import {
  ModelGatewayConfigViewSchema,
  ModelGatewayConsentInputSchema,
  ModelGatewayCreateInputSchema,
  ModelGatewayRenameInputSchema,
  ModelGatewayRevokeInputSchema,
  ModelGatewayRotateKeyInputSchema,
  ModelGatewaySettingsViewSchema,
  type ModelGatewayConfigView,
  type ModelGatewayConsentInput,
  type ModelGatewayCreateInput,
  type ModelGatewayRenameInput,
  type ModelGatewayRevokeInput,
  type ModelGatewayRotateKeyInput,
  type ModelGatewaySettingsView,
} from "@/contracts/model-gateway";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";

export type ModelGatewayConfigRecord = {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly originId: string | null;
  readonly canonicalOrigin: string;
  readonly basePath: string;
  readonly adapterKind: string;
  readonly model: string;
  readonly revision: number;
  readonly configFingerprint: string;
  readonly state: string;
  readonly consentPolicyVersion: string | null;
  readonly consentedBaseUrl: string | null;
  readonly consentedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export interface ModelGatewaySettingsRepository {
  listConfigs(userId: string): Promise<readonly ModelGatewayConfigRecord[]>;
  findConfig(userId: string, configId: string): Promise<ModelGatewayConfigRecord | null>;
}

export interface ModelGatewayVaultStore {
  hasApiKey(userId: string, configId: string): Promise<boolean>;
  create(userId: string, input: ModelGatewayCreateInput, configId: string, now: string): Promise<void>;
  activate(userId: string, input: ModelGatewayConsentInput, now: string): Promise<boolean>;
  rename(userId: string, input: ModelGatewayRenameInput, now: string): Promise<boolean>;
  rotate(userId: string, input: ModelGatewayRotateKeyInput, now: string): Promise<boolean>;
  revoke(userId: string, configId: string, now: string): Promise<boolean>;
}

export class ModelGatewayAccessError extends Error {
  constructor() {
    super("Model gateway configuration is unavailable");
    this.name = "ModelGatewayAccessError";
  }
}

async function publicConfig(
  expectedUserId: string,
  record: ModelGatewayConfigRecord,
  vault: ModelGatewayVaultStore,
): Promise<ModelGatewayConfigView> {
  if (
    record.userId !== expectedUserId ||
    record.adapterKind !== "openai-compatible"
  ) {
    throw new ModelGatewayAccessError();
  }
  const baseUrl = `${record.canonicalOrigin}${record.basePath}`;
  const consentParts = [record.consentedBaseUrl, record.consentPolicyVersion, record.consentedAt];
  if (consentParts.some((part) => part === null) && !consentParts.every((part) => part === null)) {
    throw new ModelGatewayAccessError();
  }
  const hasConsent = record.consentedBaseUrl !== null;
  if (
    (record.state === "active" && !hasConsent) ||
    (record.state === "pending_consent" && hasConsent) ||
    (hasConsent && record.consentedBaseUrl !== baseUrl)
  ) {
    throw new ModelGatewayAccessError();
  }
  return ModelGatewayConfigViewSchema.parse({
    id: record.id,
    displayName: record.displayName,
    baseUrl,
    model: record.model,
    revision: record.revision,
    configFingerprint: record.configFingerprint,
    state: record.state,
    consent: record.consentedBaseUrl === null ? null : {
      exactBaseUrl: record.consentedBaseUrl,
      policyVersion: record.consentPolicyVersion,
      consentedAt: record.consentedAt,
    },
    hasApiKey: await vault.hasApiKey(expectedUserId, record.id),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export interface ModelGatewaySettingsService {
  read(userId: string): Promise<ModelGatewaySettingsView>;
  create(userId: string, input: ModelGatewayCreateInput): Promise<ModelGatewayConfigView>;
  activate(userId: string, input: ModelGatewayConsentInput): Promise<ModelGatewayConfigView>;
  rename(userId: string, input: ModelGatewayRenameInput): Promise<ModelGatewayConfigView>;
  rotate(userId: string, input: ModelGatewayRotateKeyInput): Promise<ModelGatewayConfigView>;
  revoke(userId: string, input: ModelGatewayRevokeInput): Promise<ModelGatewayConfigView>;
}

export function createModelGatewaySettingsService({
  repository,
  vault,
  now,
  configId,
}: {
  readonly repository: ModelGatewaySettingsRepository;
  readonly vault: ModelGatewayVaultStore;
  readonly now: () => string;
  readonly configId: () => string;
}): ModelGatewaySettingsService {
  async function owned(userId: string, id: string): Promise<ModelGatewayConfigRecord> {
    const record = await repository.findConfig(userId, id);
    if (!record || record.userId !== userId) throw new ModelGatewayAccessError();
    return record;
  }

  async function view(userId: string, id: string): Promise<ModelGatewayConfigView> {
    return publicConfig(userId, await owned(userId, id), vault);
  }

  return {
    async read(userId) {
      const configs = await repository.listConfigs(userId);
      if (configs.length > 20 || configs.some((item) => item.userId !== userId)) {
        throw new ModelGatewayAccessError();
      }
      return ModelGatewaySettingsViewSchema.parse({
        configs: await Promise.all(configs.map((record) => publicConfig(userId, record, vault))),
      });
    },

    async create(userId, input) {
      const id = configId();
      await vault.create(userId, input, id, now());
      const created = await owned(userId, id);
      if (`${created.canonicalOrigin}${created.basePath}` !== input.baseUrl || created.state !== "pending_consent") {
        throw new ModelGatewayAccessError();
      }
      return publicConfig(userId, created, vault);
    },

    async activate(userId, input) {
      const current = await owned(userId, input.configId);
      if (current.state !== "pending_consent" || `${current.canonicalOrigin}${current.basePath}` !== input.exactBaseUrl) {
        throw new ModelGatewayAccessError();
      }
      if (!await vault.activate(userId, input, now())) throw new ModelGatewayAccessError();
      const activated = await owned(userId, input.configId);
      if (activated.state !== "active" || activated.consentedBaseUrl !== input.exactBaseUrl) {
        throw new ModelGatewayAccessError();
      }
      return publicConfig(userId, activated, vault);
    },

    async rename(userId, input) {
      const current = await owned(userId, input.configId);
      if (current.state === "revoked" || !await vault.rename(userId, input, now())) {
        throw new ModelGatewayAccessError();
      }
      return view(userId, input.configId);
    },

    async rotate(userId, input) {
      const current = await owned(userId, input.configId);
      if (current.state === "revoked" || !await vault.rotate(userId, input, now())) {
        throw new ModelGatewayAccessError();
      }
      return view(userId, input.configId);
    },

    async revoke(userId, input) {
      await owned(userId, input.configId);
      if (!await vault.revoke(userId, input.configId, now())) throw new ModelGatewayAccessError();
      const revoked = await owned(userId, input.configId);
      if (revoked.state !== "revoked") throw new ModelGatewayAccessError();
      return publicConfig(userId, revoked, vault);
    },
  };
}

const MAX_BODY_BYTES = 8 * 1024;

async function boundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new TypeError("invalid body");
  }
  if (!request.body) throw new TypeError("invalid body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new TypeError("invalid body");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function noStore(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authenticationFailure(result: Extract<WebSessionResult, { ok: false }>, requestId: string) {
  const code = result.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED";
  const message = result.reason === "missing" ? "Authentication is required" : "Your session has expired";
  return noStore(failure({ code, message, retryable: false }, requestId), 401);
}

function invalid(requestId: string) {
  return noStore(failure({ code: "VALIDATION_FAILED", message: "Invalid request", retryable: false }, requestId), 400);
}

function failed(error: unknown, requestId: string) {
  if (error instanceof ModelGatewayAccessError) {
    return noStore(failure({ code: "FORBIDDEN", message: "Model gateway configuration not found", retryable: false }, requestId), 404);
  }
  return noStore(failure({ code: "INTERNAL_ERROR", message: "Model gateway settings are unavailable", retryable: true }, requestId), 500);
}

type HttpDependencies = {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly service: ModelGatewaySettingsService;
  readonly appUrl: string;
  readonly requestId: () => string;
};

export function createModelGatewayHttpHandlers(dependencies: HttpDependencies) {
  const expectedOrigin = new URL(dependencies.appUrl).origin;

  async function mutation<T>(
    request: Request,
    schema: z.ZodType<T>,
    action: (userId: string, input: T) => Promise<ModelGatewayConfigView>,
    status = 200,
  ): Promise<Response> {
    const requestId = dependencies.requestId();
    const auth = await dependencies.authenticate(request);
    if (!auth.ok) return authenticationFailure(auth, requestId);
    if (request.headers.get("origin") !== expectedOrigin) {
      return noStore(failure({ code: "FORBIDDEN", message: "Request origin is not allowed", retryable: false }, requestId), 403);
    }
    let value: unknown;
    try {
      value = await boundedJson(request);
    } catch {
      return invalid(requestId);
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) return invalid(requestId);
    try {
      return noStore(success(await action(auth.userId, parsed.data), requestId), status);
    } catch (error) {
      return failed(error, requestId);
    }
  }

  return {
    async get(request: Request) {
      const requestId = dependencies.requestId();
      const auth = await dependencies.authenticate(request);
      if (!auth.ok) return authenticationFailure(auth, requestId);
      try {
        return noStore(success(await dependencies.service.read(auth.userId), requestId), 200);
      } catch (error) {
        return failed(error, requestId);
      }
    },
    async put(request: Request) {
      const requestId = dependencies.requestId();
      const auth = await dependencies.authenticate(request);
      if (!auth.ok) return authenticationFailure(auth, requestId);
      if (request.headers.get("origin") !== expectedOrigin) {
        return noStore(failure({ code: "FORBIDDEN", message: "Request origin is not allowed", retryable: false }, requestId), 403);
      }
      let value: unknown;
      try { value = await boundedJson(request); } catch { return invalid(requestId); }
      const matches = [
        { schema: ModelGatewayCreateInputSchema, action: dependencies.service.create, status: 201 },
        { schema: ModelGatewayRenameInputSchema, action: dependencies.service.rename, status: 200 },
        { schema: ModelGatewayRotateKeyInputSchema, action: dependencies.service.rotate, status: 200 },
      ].flatMap((candidate) => {
        const parsed = candidate.schema.safeParse(value);
        return parsed.success ? [{ ...candidate, data: parsed.data }] : [];
      });
      if (matches.length !== 1) return invalid(requestId);
      try {
        const match = matches[0];
        return noStore(success(await match.action(auth.userId, match.data as never), requestId), match.status);
      } catch (error) {
        return failed(error, requestId);
      }
    },
    delete: (request: Request) => mutation(request, ModelGatewayRevokeInputSchema, dependencies.service.revoke),
    consent: (request: Request) => mutation(request, ModelGatewayConsentInputSchema, dependencies.service.activate),
  };
}
