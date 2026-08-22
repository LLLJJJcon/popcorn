import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ModelGatewayConsentInput,
  ModelGatewayCreateInput,
  ModelGatewayRenameInput,
  ModelGatewayRotateKeyInput,
} from "@/contracts/model-gateway";
import type { ModelGatewayVaultStore } from "@/server/model-gateway/settings-service";
import type { Database } from "@/types/database.generated";

export function createVaultSecretStore(client: SupabaseClient<Database>): ModelGatewayVaultStore {
  async function rpcBoolean(
    name: "activate_user_model_gateway_config" | "rotate_user_model_gateway_key" |
      "rename_user_model_gateway_config" | "revoke_user_model_gateway_config",
    args: Record<string, string>,
  ): Promise<boolean> {
    const result = await client.rpc(name, args as never);
    if (result.error || typeof result.data !== "boolean") throw new Error("model gateway lifecycle operation failed");
    return result.data;
  }

  return {
    async hasApiKey(userId, configId) {
      const result = await client.rpc("has_user_model_gateway_secret", {
        p_user_id: userId,
        p_config_id: configId,
      });
      if (result.error || typeof result.data !== "boolean") throw new Error("model gateway credential status unavailable");
      return result.data;
    },

    async create(userId: string, input: ModelGatewayCreateInput, configId: string, now: string) {
      const url = new URL(input.baseUrl);
      const result = await client.rpc("create_user_model_gateway_config", {
        p_user_id: userId,
        p_config_id: configId,
        p_canonical_origin: url.origin,
        p_base_path: url.pathname === "/" ? "" : url.pathname,
        p_display_name: input.displayName,
        p_model: input.model,
        p_api_key: input.apiKey,
        p_now: now,
      });
      if (
        result.error ||
        !Array.isArray(result.data) ||
        result.data.length !== 1 ||
        result.data[0]?.config_id !== configId ||
        result.data[0]?.state !== "pending_consent" ||
        !Number.isInteger(result.data[0]?.revision) ||
        result.data[0].revision < 1
      ) {
        throw new Error("model gateway creation failed");
      }
    },

    activate(userId: string, input: ModelGatewayConsentInput, now: string) {
      return rpcBoolean("activate_user_model_gateway_config", {
        p_user_id: userId,
        p_config_id: input.configId,
        p_exact_origin: input.exactBaseUrl,
        p_policy_version: input.policyVersion,
        p_now: now,
      });
    },

    rename(userId: string, input: ModelGatewayRenameInput, now: string) {
      return rpcBoolean("rename_user_model_gateway_config", {
        p_user_id: userId,
        p_config_id: input.configId,
        p_display_name: input.displayName,
        p_now: now,
      });
    },

    rotate(userId: string, input: ModelGatewayRotateKeyInput, now: string) {
      return rpcBoolean("rotate_user_model_gateway_key", {
        p_user_id: userId,
        p_config_id: input.configId,
        p_api_key: input.apiKey,
        p_now: now,
      });
    },

    revoke(userId: string, configId: string, now: string) {
      return rpcBoolean("revoke_user_model_gateway_config", {
        p_user_id: userId,
        p_config_id: configId,
        p_now: now,
      });
    },
  };
}
