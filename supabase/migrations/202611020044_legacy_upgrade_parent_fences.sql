-- Parent UPDATE locks conflict with FK KEY SHARE taken by an INSERT. SHARE
-- locks protect existing edits but cannot fence a new neighboring segment.
do $$
declare definition text;
 source_anchor constant text:=$anchor$ perform 1 from public.video_sources where user_id=p_user_id and id=source_uuid for share;$anchor$;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,source_anchor)=0 then raise exception 'Upgrade source parent anchor missing';end if;
 definition:=replace(definition,source_anchor,$replacement$ if p_input->'source'->>'kind'='existing_card' then
  perform 1 from public.video_sources where user_id=p_user_id and id=source_uuid for share;
 else
  perform 1 from public.video_sources where user_id=p_user_id and id=source_uuid for update;
 end if;$replacement$);
 execute definition;
 definition:=pg_get_functiondef('private.legacy_upgrade_lock_evidence(uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'public.saved_items where user_id=p_user_id and id=save for share','public.saved_items where user_id=p_user_id and id=save for update');
 definition:=replace(definition,$anchor$public.video_snapshots where user_id=p_user_id and id=(source->>'snapshotId')::uuid and video_source_id=(source->>'sourceId')::uuid for share$anchor$,$replacement$public.video_snapshots where user_id=p_user_id and id=(source->>'snapshotId')::uuid and video_source_id=(source->>'sourceId')::uuid for update$replacement$);
 execute definition;
end $$;
