import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";
import type {
  ModelGatewayConfigRecord,
  ModelGatewayOriginRecord,
  ModelGatewaySettingsRepository,
} from "@/server/model-gateway/settings-service";

type OriginRow = Database["public"]["Tables"]["model_gateway_origins"]["Row"];
type ConfigRow = Database["public"]["Tables"]["user_model_gateway_configs"]["Row"];

function originRecord(row: OriginRow): ModelGatewayOriginRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    canonicalOrigin: row.canonical_origin,
    adapterKind: row.adapter_kind,
    state: row.state,
  };
}

function configRecord(row: ConfigRow & { model_gateway_origins: OriginRow }): ModelGatewayConfigRecord {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    originId: row.origin_id,
    origin: originRecord(row.model_gateway_origins),
    adapterKind: row.adapter_kind,
    model: row.model,
    revision: row.revision,
    configFingerprint: row.config_fingerprint,
    state: row.state,
    consentPolicyVersion: row.consent_policy_version,
    consentedOrigin: row.consented_origin,
    consentedAt: row.consented_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const originColumns = "id,slug,display_name,canonical_origin,adapter_kind,state,base_path,created_at,updated_at";
const configColumns = `id,user_id,display_name,origin_id,adapter_kind,model,revision,config_fingerprint,state,consent_policy_version,consented_origin,consented_at,revoked_at,created_at,updated_at,model_gateway_origins!inner(${originColumns})`;

export function createModelGatewaySettingsRepository(
  client: SupabaseClient<Database>,
): ModelGatewaySettingsRepository {
  return {
    async listOrigins() {
      const result = await client
        .from("model_gateway_origins")
        .select(originColumns)
        .eq("state", "active")
        .order("display_name", { ascending: true })
        .limit(50);
      if (result.error || !Array.isArray(result.data)) throw new Error("model gateway catalog unavailable");
      return (result.data as OriginRow[]).map(originRecord);
    },

    async findOrigin(originId) {
      const result = await client
        .from("model_gateway_origins")
        .select(originColumns)
        .eq("state", "active")
        .eq("id", originId)
        .maybeSingle();
      if (result.error) throw new Error("model gateway catalog unavailable");
      return result.data ? originRecord(result.data as OriginRow) : null;
    },

    async listConfigs(userId) {
      const result = await client
        .from("user_model_gateway_configs")
        .select(configColumns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (result.error || !Array.isArray(result.data)) throw new Error("model gateway settings unavailable");
      const records: ModelGatewayConfigRecord[] = [];
      for (const row of result.data as unknown as (ConfigRow & { model_gateway_origins: OriginRow })[]) {
        const record = configRecord(row);
        if (record.userId !== userId) throw new Error("model gateway settings unavailable");
        records.push(record);
      }
      return records;
    },

    async findConfig(userId, configId) {
      const result = await client
        .from("user_model_gateway_configs")
        .select(configColumns)
        .eq("user_id", userId)
        .eq("id", configId)
        .maybeSingle();
      if (result.error) throw new Error("model gateway settings unavailable");
      if (!result.data) return null;
      const record = configRecord(result.data as unknown as ConfigRow & { model_gateway_origins: OriginRow });
      return record.userId === userId ? record : null;
    },
  };
}
