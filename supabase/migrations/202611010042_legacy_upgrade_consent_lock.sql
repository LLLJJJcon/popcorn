-- Publication must serialize with consent revocation, not merely observe an
-- older MVCC snapshot while the revoker owns the configuration row.
do $$
declare definition text;
 anchor constant text:=$anchor$elsif not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin join public.user_model_gateway_configs config on config.id=pin.config_id and config.user_id=p_user_id where pin.config_id=(op.gateway_pin->>'configId')::uuid and pin.revision=(op.gateway_pin->>'revision')::integer and pin.config_fingerprint=op.gateway_pin->>'fingerprint' and config.model=p_result->>'model') then$anchor$;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Upgrade gateway fence anchor missing';end if;
 execute replace(definition,anchor,$replacement$elsif private.lock_active_user_model_gateway_config(p_user_id,(op.gateway_pin->>'configId')::uuid,(op.gateway_pin->>'revision')::integer,op.gateway_pin->>'fingerprint') is distinct from p_result->>'model' then$replacement$);
end $$;
