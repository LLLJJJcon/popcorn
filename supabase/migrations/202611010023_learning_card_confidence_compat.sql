-- Modern learning cards have no model confidence. Preserve the frozen canonical
-- occurrence column internally without adding that field back to the card.
-- Patch only the old shape guard and occurrence projection; promotion criteria,
-- ownership, transaction fences, receipts and 1-day scheduling remain identical.
do $$
declare
  signature constant regprocedure := 'private.promote_valid_practice_draft_attempt_source_active(uuid,uuid,text,timestamp with time zone,integer)'::regprocedure;
  definition text;
  old_guard constant text := 'or jsonb_typeof(v_candidate -> ''confidence'') is distinct from ''number'' then';
  new_guard constant text := 'or (jsonb_typeof(v_candidate -> ''confidence'') is distinct from ''number''
      and (jsonb_typeof(v_candidate -> ''meaningHere'') is distinct from ''string''
        or v_candidate ? ''confidence'')) then';
  old_projection constant text := '(v_candidate ->> ''confidence'')::numeric,';
  new_projection constant text := 'coalesce((v_candidate ->> ''confidence'')::numeric, 1),';
begin
  definition := pg_catalog.pg_get_functiondef(signature);
  if pg_catalog.strpos(definition, old_guard) = 0
    or pg_catalog.strpos(definition, old_projection) = 0 then
    raise exception 'Expected legacy confidence guards missing in %', signature;
  end if;
  definition := pg_catalog.replace(definition, old_guard, new_guard);
  definition := pg_catalog.replace(definition, old_projection, new_projection);
  execute definition;
end
$$;
