import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  ModelGatewayError,
  type ModelGatewayPin,
} from "@/server/ai/provider";
import type { Database } from "@/types/database.generated";

const RuntimeRowSchema = z.strictObject({
  display_name: z.string().min(1).max(80),
  canonical_origin: z.string().url().max(253),
  base_path: z.string().max(200).regex(/^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?$/).or(z.literal("")),
  adapter_kind: z.string().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  revision: z.number().int().positive(),
  config_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  api_key: z.string().min(1).max(4096),
  credential_revision: z.number().int().positive(),
});

export type ModelGatewayRuntimeConfig = {
  readonly adapterKind: "openai-compatible";
  readonly canonicalOrigin: string;
  readonly basePath: string;
  readonly model: string;
  readonly revision: number;
  readonly configFingerprint: string;
  readonly apiKey: string;
};

export interface ModelGatewayRuntimeResolver {
  resolve(
    expectedUserId: string,
    pin: ModelGatewayPin,
  ): Promise<ModelGatewayRuntimeConfig>;
}

function unavailable(): ModelGatewayError {
  return new ModelGatewayError("PROVIDER_UNAVAILABLE");
}

function exactHttpsOrigin(value: string): string {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.origin !== value
  ) {
    throw unavailable();
  }
  return parsed.origin;
}

export function createSupabaseModelGatewayRuntimeResolver(
  client: Pick<SupabaseClient<Database>, "rpc">,
): ModelGatewayRuntimeResolver {
  return {
    async resolve(expectedUserId, pin) {
      try {
        const result = await client.rpc("resolve_user_model_gateway_config", {
          p_user_id: expectedUserId,
          p_config_id: pin.configId,
          p_expected_revision: pin.revision,
        });
        if (result.error || result.data.length !== 1) throw unavailable();
        const row = RuntimeRowSchema.parse(result.data[0]);
        if (
          row.adapter_kind !== "openai-compatible" ||
          row.revision !== pin.revision ||
          row.config_fingerprint !== pin.fingerprint
        ) {
          throw unavailable();
        }
        return {
          adapterKind: row.adapter_kind,
          canonicalOrigin: exactHttpsOrigin(row.canonical_origin),
          basePath: row.base_path,
          model: row.model,
          revision: row.revision,
          configFingerprint: row.config_fingerprint,
          apiKey: row.api_key,
        };
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw unavailable();
      }
    },
  };
}
