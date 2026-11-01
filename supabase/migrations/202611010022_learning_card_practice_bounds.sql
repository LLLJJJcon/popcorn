-- A user mark already accepts 10,000 UTF-16 code units. Carry that same bound
-- through staged/canonical practice and Vault without changing scoring rules.
alter table public.practice_drafts drop constraint practice_draft_text_check;
alter table public.practice_drafts add constraint practice_draft_text_check check (
  private.is_target_chinese(target_expression, 10000)
  and private.is_target_chinese(prompt_chinese, 2000)
  and private.is_basic_latin_english(instructions_english, 1000)
  and private.is_basic_latin_english(goal_english, 1000)
);

alter table public.practice_tasks drop constraint practice_task_text_check;
alter table public.practice_tasks add constraint practice_task_text_check check (
  private.is_target_chinese(target_expression, 10000)
  and private.is_target_chinese(prompt_chinese, 2000)
  and private.is_basic_latin_english(instructions_english, 1000)
  and private.is_basic_latin_english(goal_english, 1000)
);

alter table public.expression_senses drop constraint expression_sense_text_check;
alter table public.expression_senses add constraint expression_sense_text_check check (
  private.is_target_chinese(expression_text, 10000)
  and private.is_target_chinese(normalized_expression_text, 10000)
  and private.is_learning_card_prose(english_meaning, 2000)
  and private.is_learning_card_prose(english_explanation, 2000)
  and private.is_learning_card_prose(tone, 2000)
  and private.is_learning_card_prose(communicative_function, 300)
  and private.is_learning_card_prose(register, 200)
);

-- Keep the owner-scoped index and exact stored values; hash only the btree key
-- so a valid, uncompressible 30kB Chinese value cannot exceed an index-row limit.
-- Search ranking still compares full text and uses the existing trigram indexes.
drop index public.expression_senses_normalized_text_idx;
create index expression_senses_normalized_text_idx
  on public.expression_senses (user_id, (pg_catalog.md5(normalized_expression_text)));

alter table public.expression_occurrences drop constraint expression_occurrence_evidence_check;
alter table public.expression_occurrences add constraint expression_occurrence_evidence_check
  check (private.is_target_chinese(evidence_text, 10000));

alter table private.practice_promotion_receipts drop constraint practice_promotion_receipt_normalized_check;
alter table private.practice_promotion_receipts add constraint practice_promotion_receipt_normalized_check check (
  private.is_target_chinese(normalized_expression_text, 10000)
  and normalized_expression_text = btrim(normalized_expression_text)
);

alter table public.practice_draft_attempts drop constraint practice_draft_attempt_response_check;
alter table public.practice_draft_attempts add constraint practice_draft_attempt_response_check
  check (private.is_target_chinese(response_chinese, 10000));
alter table public.attempts drop constraint attempt_response_check;
alter table public.attempts add constraint attempt_response_check
  check (private.is_target_chinese(response_chinese, 10000));

-- Replace just the length guard in both the v3-copying implementation and the
-- source-deletion replay wrapper. Their promotion, idempotency, ACL and ownership
-- checks stay intact. A missing expected guard aborts instead of silently drifting.
do $$
declare
  signature regprocedure;
  definition text;
  old_guard constant text := 'private.is_target_chinese(p_normalized_expression_text, 200)';
  new_guard constant text := 'private.is_target_chinese(p_normalized_expression_text, 10000)';
begin
  foreach signature in array array[
    'private.promote_valid_practice_draft_attempt_source_active(uuid,uuid,text,timestamp with time zone,integer)'::regprocedure,
    'public.promote_valid_practice_draft_attempt(uuid,uuid,text,timestamp with time zone,integer)'::regprocedure
  ] loop
    definition := pg_catalog.pg_get_functiondef(signature);
    if pg_catalog.strpos(definition, old_guard) = 0 then
      raise exception 'Expected promotion length guard missing in %', signature;
    end if;
    execute pg_catalog.replace(definition, old_guard, new_guard);
  end loop;
end
$$;
