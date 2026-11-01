-- Real publication/source-deletion contention exposed a source->sense lock
-- inversion. Preserve source-free receipt replay, then acquire that same order.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,'outcome=outcome,updated_at=p_now')=0 or strpos(definition,'origin text;')=0 then raise exception 'Upgrade publication repair anchor missing';end if;
 definition:=replace(definition,'outcome=outcome,updated_at=p_now','outcome=publish_legacy_learning_card_upgrade.outcome,updated_at=p_now');
 definition:=replace(definition,'origin text;','origin text;source_uuid uuid;prior jsonb;');
 definition:=replace(definition,' perform private.legacy_upgrade_check_input(p_input);', $repair$ perform private.legacy_upgrade_check_input(p_input);
 if p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid upgrade clock';end if;
 prior:=public.lookup_legacy_learning_card_upgrade(p_user_id,p_input,p_now);
 if prior is not null and prior->>'status'<>'in_progress' then return prior;end if;
 select video_source_id into source_uuid from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid;
 perform 1 from public.video_sources where user_id=p_user_id and id=source_uuid for key share;
 if not found then raise exception using errcode='P0001',message='STALE_PLAN';end if;
 if jsonb_typeof(p_result) is distinct from 'object' or not(p_result ?& array['origin','card']) then raise exception using errcode='22023',message='invalid upgrade publication';end if;
 if p_result->>'origin'='existing_card' then
  if(select count(*) from jsonb_object_keys(p_result))<>2 then raise exception using errcode='22023',message='invalid upgrade publication';end if;
 elsif p_result->>'origin'='model' then
  if not(p_result ?& array['promptVersion','model','pin']) or(select count(*) from jsonb_object_keys(p_result))<>5 or jsonb_typeof(p_result->'promptVersion')<>'string' or jsonb_typeof(p_result->'model')<>'string' then raise exception using errcode='22023',message='invalid upgrade publication';end if;
 else raise exception using errcode='22023',message='invalid upgrade publication';end if;$repair$);
 execute definition;
 definition:=pg_get_functiondef('private.legacy_upgrade_evidence(uuid,jsonb)'::regprocedure);
 if strpos(definition,' if joined is distinct from')=0 then raise exception 'Upgrade source proof anchor missing';end if;
 definition:=replace(definition,' if joined is distinct from',$repair$ if (select min((v->>'startSeconds')::numeric) from jsonb_array_elements(c->'segments') v where(v->>'target')::boolean) is distinct from (c->>'startSeconds')::numeric or(select max((v->>'endSeconds')::numeric) from jsonb_array_elements(c->'segments') v where(v->>'target')::boolean) is distinct from (c->>'endSeconds')::numeric then return null;end if;
 if joined is distinct from$repair$);
 execute definition;
end $$;
