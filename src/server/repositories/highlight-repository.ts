import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SavedHighlightSchema, type HighlightSelection, type SavedHighlight } from '@/contracts/highlights';
import type { Database } from '@/types/database.generated';
import { normalizeHighlightSelection, resolveSavedItemTarget } from '@/server/domain/saved-item-target';
import { SavedItemKindSchema } from '@/contracts/source';
type HighlightRow = Database['public']['Tables']['saved_item_highlights']['Row'];
export function highlightView(row: HighlightRow): SavedHighlight {
  return SavedHighlightSchema.parse({
    id: row.id,
    savedItemId: row.saved_item_id,
    startSegmentId: row.start_segment_id,
    startOffset: row.start_offset,
    endSegmentId: row.end_segment_id,
    endOffset: row.end_offset,
    text: row.text,
    origin: row.origin,
    reasonEn: row.reason_en,
    status: row.status
  });
}
export function createSupabaseHighlightRepository(client: SupabaseClient<Database>) {
  async function read(userId: string, savedItemId: string) {
    const save = await client.from('saved_items').select('id,user_id,video_source_id,snapshot_id,kind,status,payload,start_seconds,highlight_status').eq('user_id', userId).eq('id', savedItemId).is('removed_from_saved_at', null).maybeSingle();
    if (save.error)
      throw save.error;
    if (!save.data || save.data.status !== 'ready' || !save.data.snapshot_id)
      return null;
    const kind = SavedItemKindSchema.safeParse(save.data.kind);
    if (!kind.success || kind.data === 'video')
      return null;
    const all = [];
    for (let from = 0;; from += 1000) {
      const lines = await client.from('transcript_segments').select('stable_id,original_chinese,start_seconds,end_seconds').eq('user_id', userId).eq('snapshot_id', save.data.snapshot_id).order('position', { ascending: true }).range(from, from + 999);
      if (lines.error)
        throw lines.error;
      all.push(...lines.data.map(row => ({
        id: row.stable_id,
        text: row.original_chinese,
        startSeconds: row.start_seconds,
        endSeconds: row.end_seconds
      })));
      if (lines.data.length < 1000)
        break;
    }
    const marks = await client.from('saved_item_highlights').select('*').eq('user_id', userId).eq('saved_item_id', savedItemId).eq('status', 'active').order('created_at', { ascending: true });
    if (marks.error)
      throw marks.error;
    return { save: save.data, ...resolveSavedItemTarget(kind.data, save.data.payload, all, save.data.start_seconds), highlights: marks.data.map(highlightView) };
  }
  async function result(userId: string, savedItemId: string) {
    const value = await read(userId, savedItemId);
    return value ? { highlights: value.highlights, highlightStatus: value.save.highlight_status ?? 'unavailable' } : null;
  }
  return {
    read,
    async add(userId: string, savedItemId: string, selection: HighlightSelection) {
      const context = await read(userId, savedItemId);
      if (!context)
        return null;
      const selected = normalizeHighlightSelection(context.targetSegments, selection);
      const response = await client.rpc('mutate_saved_item_highlight', {
        p_user_id: userId,
        p_saved_item_id: savedItemId,
        p_action: 'add',
        p_highlight_id: null,
        p_start_segment_id: selected.startSegmentId,
        p_start_offset: selected.startOffset,
        p_end_segment_id: selected.endSegmentId,
        p_end_offset: selected.endOffset,
        p_text: selected.text,
        p_now: new Date().toISOString()
      });
      if (response.error)
        throw response.error;
      if (!response.data)
        return null;
      return result(userId, savedItemId);
    },
    async change(userId: string, savedItemId: string, highlightId: string, action: 'remove' | 'restore') {
      const response = await client.rpc('mutate_saved_item_highlight', {
        p_user_id: userId,
        p_saved_item_id: savedItemId,
        p_action: action,
        p_highlight_id: highlightId,
        p_start_segment_id: null,
        p_start_offset: null,
        p_end_segment_id: null,
        p_end_offset: null,
        p_text: null,
        p_now: new Date().toISOString()
      });
      if (response.error)
        throw response.error;
      if (!response.data)
        return null;
      return result(userId, savedItemId);
    },
    async suggest(userId: string, savedItemId: string) {
      const context = await read(userId, savedItemId);
      if (!context)
        return null;
      if (context.save.highlight_status !== null && context.save.highlight_status !== 'unavailable')
        return { ...await result(userId, savedItemId), queued: false };
      const active = await client.rpc('resolve_active_user_model_gateway_pin', { p_user_id: userId });
      if (active.error)
        throw active.error;
      const pin = active.data[0];
      if (!pin)
        return { ...await result(userId, savedItemId), gatewayRequired: true, queued: false };
      const key = createHash('sha256').update(['highlight_saved_item', savedItemId, crypto.randomUUID()].join(':')).digest('hex');
      const input = {
        kind: 'highlight_saved_item',
        savedItemId,
        snapshotId: context.save.snapshot_id!,
        gatewayConfigId: pin.config_id,
        gatewayRevision: pin.revision,
        gatewayFingerprint: pin.config_fingerprint
      };
      const registered = await client.rpc('register_saved_item_highlight_suggestion', {
        p_user_id: userId,
        p_saved_item_id: savedItemId,
        p_dedupe_key: key,
        p_input: input,
        p_config_id: pin.config_id,
        p_expected_config_revision: pin.revision,
        p_expected_config_fingerprint: pin.config_fingerprint,
        p_now: new Date().toISOString()
      });
      if (registered.error)
        throw registered.error;
      return { ...await result(userId, savedItemId), queued: registered.data };
    }
  };
}
export type HighlightRepository = ReturnType<typeof createSupabaseHighlightRepository>;
