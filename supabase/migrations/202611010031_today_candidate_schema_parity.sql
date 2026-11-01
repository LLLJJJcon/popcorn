-- Match CandidateExpressionSchema when picking a readable historical card.
-- Invalid optional metadata cannot supersede an older valid version. These
-- checks select existing evidence; they never rewrite it or reclassify legacy
-- suitability. Generation's extra semantic checks remain in its own pipeline.
create or replace function private.today_valid_card(c jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare
 field text; value jsonb; modern boolean; normalized text; state jsonb;
 uuid_pattern constant text := '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
 -- ECMAScript trim/split whitespace, including Unicode space separators.
 spaces constant text := E'\t\n\v\f\r '||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 if jsonb_typeof(c) is distinct from 'object' then return false;end if;
 if exists(select 1 from jsonb_object_keys(c) k where k not in('expression','englishMeaning','englishExplanation','tone','communicativeFunction','register','evidenceText','segmentIds','startSeconds','endSeconds','confidence','highlightId','highlightKey','practiceState','meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability','notExpressionReasonEn')) then return false;end if;
 foreach field in array array['expression','englishMeaning','englishExplanation','tone','communicativeFunction','register','evidenceText'] loop
  if jsonb_typeof(c->field) is distinct from 'string' or length(btrim(c->>field,spaces))=0 then return false;end if;
 end loop;
 foreach field in array array['englishMeaning','englishExplanation','tone','communicativeFunction','register'] loop
  if private.utf16_length(c->>field)>2000 then return false;end if;
 end loop;
 if not private.is_target_chinese(c->>'expression',10000) or not private.is_target_chinese(c->>'evidenceText',10000) then return false;end if;
 if jsonb_typeof(c->'segmentIds') is distinct from 'array' then return false;end if;
 if jsonb_array_length(c->'segmentIds') not between 1 and 32 then return false;end if;
 for value in select * from jsonb_array_elements(c->'segmentIds') loop
  if jsonb_typeof(value) is distinct from 'string' or private.utf16_length(value#>>'{}') not between 1 and 200
   or btrim(value#>>'{}',spaces) is distinct from value#>>'{}' then return false;end if;
 end loop;
 if jsonb_typeof(c->'startSeconds') is distinct from 'number' or jsonb_typeof(c->'endSeconds') is distinct from 'number' then return false;end if;
 if (c->>'startSeconds')::numeric<0 or (c->>'endSeconds')::numeric>604800 or (c->>'endSeconds')::numeric<(c->>'startSeconds')::numeric then return false;end if;
 if c ? 'confidence' then
  if jsonb_typeof(c->'confidence') is distinct from 'number' then return false;end if;
  if (c->>'confidence')::numeric not between 0 and 1 then return false;end if;
 end if;
 if c ? 'highlightId' and (jsonb_typeof(c->'highlightId') is distinct from 'string' or lower(c->>'highlightId') !~ uuid_pattern) then return false;end if;
 if c ? 'highlightKey' and (jsonb_typeof(c->'highlightKey') is distinct from 'string' or private.utf16_length(c->>'highlightKey') not between 1 and 30000) then return false;end if;
 foreach field in array array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','notExpressionReasonEn'] loop
  if not(c ? field) or (field in('watchOut','notExpressionReasonEn') and c->field='null'::jsonb) then continue;end if;
  if jsonb_typeof(c->field) is distinct from 'string' then return false;end if;
  normalized:=btrim(translate(c->>field,spaces,repeat(' ',length(spaces))));
  if private.utf16_length(normalized) not between 1 and 2000 or normalized !~ '[A-Za-z]' or cardinality(regexp_split_to_array(normalized,' +'))>40 then return false;end if;
 end loop;
 foreach field in array array['functionCategories','usageSettings'] loop
  if not(c ? field) then continue;end if;
  if jsonb_typeof(c->field) is distinct from 'array' then return false;end if;
  if field='functionCategories' and jsonb_array_length(c->field) not between 1 and 2 then return false;end if;
  if field='usageSettings' and jsonb_array_length(c->field)>3 then return false;end if;
  for value in select * from jsonb_array_elements(c->field) loop
   if jsonb_typeof(value) is distinct from 'string' then return false;end if;
   if field='functionCategories' and value#>>'{}' not in('emphasize','complain','praise','react','explain_sum_up','concede_contrast','suggest','connect_ideas','describe','other') then return false;end if;
   if field='usageSettings' and value#>>'{}' not in('casual_chat','daily_errands','work_school','formal_writing','online_social') then return false;end if;
  end loop;
 end loop;
 if c ? 'suitability' and (jsonb_typeof(c->'suitability') is distinct from 'string' or c->>'suitability' not in('expression','not_expression')) then return false;end if;
 if c ? 'examples' and c->'examples' is distinct from 'null'::jsonb then
  if jsonb_typeof(c->'examples') is distinct from 'array' then return false;end if;
  if jsonb_array_length(c->'examples')<>2 then return false;end if;
  for value in select * from jsonb_array_elements(c->'examples') loop
   if jsonb_typeof(value) is distinct from 'object' then return false;end if;
   if exists(select 1 from jsonb_object_keys(value) k where k not in('zh','en')) then return false;end if;
   if jsonb_typeof(value->'zh') is distinct from 'string' or not private.is_target_chinese(value->>'zh',10000) or char_length(value->>'zh')>30 then return false;end if;
   if jsonb_typeof(value->'en') is distinct from 'string' then return false;end if;
   normalized:=btrim(translate(value->>'en',spaces,repeat(' ',length(spaces))));
   if private.utf16_length(normalized) not between 1 and 2000 or normalized !~ '[A-Za-z]' or cardinality(regexp_split_to_array(normalized,' +'))>40 then return false;end if;
  end loop;
 end if;
 if c ? 'practiceState' then
  state:=c->'practiceState';
  if jsonb_typeof(state) is distinct from 'object' then return false;end if;
  if state->>'status'='unpracticed' then
   if state<>'{"status":"unpracticed"}'::jsonb then return false;end if;
  elsif state->>'status'='promoted' then
   if (select count(*) from jsonb_object_keys(state))<>2 or jsonb_typeof(state->'userExpressionId') is distinct from 'string' or lower(state->>'userExpressionId') !~ uuid_pattern then return false;end if;
  elsif state->>'status' in('practicing','removed') then
   if (select count(*) from jsonb_object_keys(state))<>3 or jsonb_typeof(state->'taskId') is distinct from 'string' or lower(state->>'taskId') !~ uuid_pattern or jsonb_typeof(state->'roundNumber') is distinct from 'number' then return false;end if;
   if (state->>'roundNumber')::numeric<1 or trunc((state->>'roundNumber')::numeric)<>(state->>'roundNumber')::numeric then return false;end if;
  else return false;end if;
 end if;
 modern:=c ? 'meaningHere';
 if modern then
  foreach field in array array['useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability'] loop
   if not(c ? field) then return false;end if;
  end loop;
  if c->>'suitability'='not_expression' and (c->>'notExpressionReasonEn' is null or length(btrim(c->>'notExpressionReasonEn',spaces))=0) then return false;end if;
  return true;
 end if;
 return c ? 'confidence' and private.is_target_chinese(c->>'expression',200) and private.is_target_chinese(c->>'evidenceText',2000)
  and private.is_basic_latin_english(c->>'englishMeaning',500) and private.is_basic_latin_english(c->>'englishExplanation',2000)
  and private.is_basic_latin_english(c->>'tone',200) and private.is_basic_latin_english(c->>'communicativeFunction',300) and private.is_basic_latin_english(c->>'register',200);
end $$;
