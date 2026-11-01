-- A successful regeneration receipt belongs to the original input/version.
-- Adjudicate its exact request signature before rejecting that old identity.
do $$
declare definition text;
 lookup_block constant text := $lookup$ existing:=public.lookup_review_preparation(p_user_id,r.id,p_kind,p_request_id,p_identity,p_now);
 if existing is not null then return existing;end if;
$lookup$;
 anchor constant text := $anchor$ if p_kind='regenerate' then$anchor$;
begin
 definition:=pg_get_functiondef('public.claim_review_preparation(uuid,uuid,text,uuid,jsonb,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,lookup_block)=0 or strpos(definition,anchor)=0 then raise exception 'Review request replay anchor missing';end if;
 definition:=replace(definition,lookup_block,'');
 definition:=replace(definition,anchor,lookup_block||anchor);
 execute definition;
end $$;
