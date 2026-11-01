-- A source proof must be re-read after any earlier editor commits. Row locks
-- serialize those editors through the metadata-only publication transaction.
create function private.legacy_upgrade_lock_evidence(p_user_id uuid,p_input jsonb) returns void
language plpgsql set search_path=pg_catalog as $$
declare source jsonb:=p_input->'source';save uuid;evidence_window jsonb;
begin
 if source->>'kind'='existing_card' then
  select saved_item_id into save from public.generated_artifacts where user_id=p_user_id and id=(source->>'artifactId')::uuid;
  perform 1 from public.saved_items where user_id=p_user_id and id=save for share;
  perform 1 from public.generated_artifacts where user_id=p_user_id and id=(source->>'artifactId')::uuid for share;
  perform 1 from private.practice_promotion_receipts receipt join public.user_expressions e on e.id=receipt.user_expression_id and e.user_id=p_user_id
   where receipt.user_id=p_user_id and e.expression_sense_id=(p_input->>'senseId')::uuid and receipt.candidate_key=source->>'candidateKey' for share of receipt;
 else
  perform 1 from public.video_snapshots where user_id=p_user_id and id=(source->>'snapshotId')::uuid and video_source_id=(source->>'sourceId')::uuid for share;
  perform 1 from public.expression_occurrences where user_id=p_user_id and id=(source->>'occurrenceId')::uuid and expression_sense_id=(p_input->>'senseId')::uuid and snapshot_id=(source->>'snapshotId')::uuid and video_source_id=(source->>'sourceId')::uuid for share;
  select value into evidence_window from private.legacy_upgrade_sources(p_user_id,(p_input->>'senseId')::uuid) value where value->>'occurrenceId'=source->>'occurrenceId';
  perform 1 from public.transcript_segments t where t.user_id=p_user_id and t.snapshot_id=(source->>'snapshotId')::uuid
   and t.stable_id in(select v->>'stableId' from jsonb_array_elements(evidence_window->'segments') v) order by t.position,t.id for share;
 end if;
end $$;
revoke all on function private.legacy_upgrade_lock_evidence(uuid,jsonb) from public,anon,authenticated,service_role;
do $$
declare definition text;
 anchor constant text:=$anchor$ select * into s from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid for update;$anchor$;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Upgrade evidence lock anchor missing';end if;
 definition:=replace(definition,'for key share','for share');
 definition:=replace(definition,anchor,' perform private.legacy_upgrade_lock_evidence(p_user_id,p_input);'||E'\n'||anchor);
 execute definition;
end $$;
