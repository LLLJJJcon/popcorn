-- NULL in an SQL UUID array makes NOT(id=ANY(...)) unknown for every other
-- row. Reject it explicitly rather than pretending an owner's queue is empty.
do $$ declare definition text;anchor constant text:=' if p_user_id is null or p_now is null or not isfinite(p_now) then';
begin
 definition:=pg_get_functiondef('public.get_today_practice_next(uuid,timestamptz,uuid[],uuid,uuid)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Expected today next input guard missing';end if;
 definition:=replace(definition,anchor,' if array_position(p_exclude,null) is not null then raise exception using errcode=''22023'',message=''invalid today excludes'';end if;
'||anchor);
 execute definition;
end $$;
