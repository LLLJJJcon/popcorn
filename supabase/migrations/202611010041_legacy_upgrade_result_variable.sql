-- Keep the private receipt column distinct from its PL/pgSQL local value.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,'outcome=publish_legacy_learning_card_upgrade.outcome')=0 then raise exception 'Upgrade receipt result anchor missing';end if;
 definition:=replace(definition,'outcome jsonb;origin text;','v_outcome jsonb;origin text;');
 definition:=replace(definition,'outcome:=jsonb_build_object','v_outcome:=jsonb_build_object');
 definition:=replace(definition,'outcome=publish_legacy_learning_card_upgrade.outcome','outcome=v_outcome');
 definition:=replace(definition,' return outcome;',' return v_outcome;');
 definition:=replace(definition,$anchor$ select video_source_id into source_uuid from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid;$anchor$,$replacement$ select video_source_id into source_uuid from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid;
 if not found then raise exception using errcode='22023',message='owned sense not found';end if;$replacement$);
 execute definition;
end $$;
