#!/usr/bin/env python3
"""Real independent PostgreSQL connections; isolated synthetic 59b* owners only.

Run through /private/tmp/popcorn-phase1-test-stack/with-test-stack.py.
No provider calls. Prints invariant names only, never learner answers or keys.
"""
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[2]
URL = os.environ.get("DATABASE_URL", "")
PARSED = urlparse(URL)
assert PARSED.hostname in ("127.0.0.1", "localhost") and PARSED.port == 54332, "isolated database port 54332 required"
PG_ENV = {**os.environ, "PGHOST": PARSED.hostname, "PGPORT": "54332", "PGUSER": unquote(PARSED.username or "postgres"), "PGPASSWORD": unquote(PARSED.password or ""), "PGDATABASE": unquote(PARSED.path.lstrip("/"))}
PSQL = os.environ.get("POPCORN_PSQL_BIN", "/Applications/Postgres.app/Contents/Versions/latest/bin/psql")
OWNERS = "'59b00000-0000-4000-8000-000000000001','59b00000-0000-4000-8000-000000000002'"


def execute(sql, name="removal-race-inspect", check=True):
    result = subprocess.run([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], input=sql, text=True, capture_output=True,
                            env={**PG_ENV, "PGAPPNAME": name, "PGOPTIONS": "-c statement_timeout=10000 -c lock_timeout=8000"})
    if check and result.returncode:
        raise AssertionError("isolated race SQL failed: " + result.stderr)
    return result


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(value):
    return literal(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def rpc(name, *args):
    return "select public." + name + "(" + ",".join(args) + ");"


def one(sql):
    return json.loads(execute(sql).stdout.strip().splitlines()[-1])


def race(lock_table, lock_id, winner, loser, expected_error=None, initial_sql=None, probe_sql=None):
    assert lock_table in ('expression_senses', 'video_sources', 'user_model_gateway_configs', 'transcript_segments', 'video_snapshots', 'user_expressions')
    # Hold the actual review row, not a test-only advisory lock. Confirm the
    # second real RPC waits on that row before releasing the first transaction.
    first = subprocess.Popen([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                             env={**PG_ENV, "PGAPPNAME": "removal-race-first"})
    gate=initial_sql or "select 1 from public."+lock_table+" where id="+literal(lock_id)+" for update;"
    first.stdin.write("begin;set local statement_timeout='10s';"+gate+"select pg_sleep(2);" + winner + "commit;")
    first.stdin.close()
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        if execute("select exists(select 1 from pg_stat_activity where application_name='removal-race-first' and wait_event='PgSleep');").stdout.strip() == "t":
            break
        time.sleep(.02)
    else:
        raise AssertionError("first connection never acquired review row")
    second = subprocess.Popen([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                              env={**PG_ENV, "PGAPPNAME": "removal-race-second", "PGOPTIONS": "-c statement_timeout=10000"})
    second.stdin.write(loser)
    second.stdin.close()
    blocked = False
    while time.monotonic() < deadline:
        if execute("select exists(select 1 from pg_stat_activity where application_name='removal-race-second' and wait_event_type='Lock');").stdout.strip() == "t":
            blocked = True
            break
        time.sleep(.02)
    probe=execute(probe_sql,check=False) if probe_sql else None
    first.wait(timeout=12)
    second.wait(timeout=12)
    first_out, first_error = first.stdout.read(), first.stderr.read()
    second_out, second_error = second.stdout.read(), second.stderr.read()
    assert blocked, "second connection must actually wait on the first row lock"
    assert probe is None or probe.returncode==0, "claim acquired sense before its active-expression fence"
    assert first.returncode == 0, first_error
    if expected_error:
        assert second.returncode != 0 and expected_error in second_error, second_error
        return json.loads(first_out.strip().splitlines()[-1]), None
    assert second.returncode == 0, second_error
    return json.loads(first_out.strip().splitlines()[-1]), json.loads(second_out.strip().splitlines()[-1])


def cleanup():
    existing = one("select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email)),'[]'::jsonb) from auth.users where id in(" + OWNERS + ");")
    expected = {"59b00000-0000-4000-8000-000000000001": "legacy-upgrade-a@popcorn.test", "59b00000-0000-4000-8000-000000000002": "legacy-upgrade-b@popcorn.test"}
    assert all(expected.get(row["id"]) == row["email"] for row in existing), "reserved account is not this harness fixture; cleanup aborted"
    execute("select public.revoke_user_model_gateway_config(user_id,id,now()) from public.user_model_gateway_configs where user_id in("+OWNERS+");delete from public.user_model_gateway_configs where user_id in("+OWNERS+");")
    # Named fixture accounts only. The public source deletion path first keeps
    # canonical evidence, then test teardown removes that synthetic evidence.
    execute("select public.delete_video_source(user_id,id,'remove_source_keep_evidence',now()) from public.video_sources where user_id in(" + OWNERS + ");")
    statements = ["begin;"]
    for table in ["private.review_operations", "public.review_revisions", "public.review_scenarios", "private.due_practice_completion_receipts", "private.practice_promotion_receipts"]:
        statements.append("delete from " + table + " where user_id in(" + OWNERS + ");")
    statements.append("update public.review_tasks set status='cancelled',completed_attempt_id=null,completed_at=null where user_id in(" + OWNERS + ");")
    for table in ["public.mastery_events", "public.attempts", "public.practice_tasks", "public.review_tasks", "public.user_expressions", "public.expression_occurrences", "public.expression_senses", "public.profiles"]:
        statements.append("delete from " + table + " where user_id in(" + OWNERS + ");")
    statements.append("delete from auth.users where id in(" + OWNERS + ");commit;")
    execute("".join(statements))



def seed():
    prefix=(ROOT/"supabase/tests/legacy_learning_card_upgrade.sql").read_text().split("select extensions.has_function('public','read_legacy_learning_card_upgrade_context'")[0]
    prefix=prefix.replace("599","59b").replace("select extensions.no_plan();","")
    prefix="\n".join(line for line in prefix.splitlines() if not line.startswith("select extensions.is("))
    execute(prefix+"commit;")
    owner="59b00000-0000-4000-8000-000000000001";source="59b10000-0000-4000-8000-000000000001"
    graph=one("select jsonb_build_object('sense',s.id,'expression',e.id,'review',r.id) from public.expression_senses s join public.user_expressions e on e.expression_sense_id=s.id join public.review_tasks r on r.user_expression_id=e.id where s.user_id="+literal(owner)+" and s.video_source_id="+literal(source)+" and r.status='pending';")
    context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(graph["sense"]),"0","200"));proof=context["sources"][0]
    request={"requestId":"59bf0000-0000-4000-8000-000000000001","senseId":graph["sense"],"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
    card={"meaningHere":"The price is excessively high.","useItWhen":"When complaining about excessive prices.","comparedWith":"很高 is neutral.","howItFits":"After an adjective.","toneAndWho":"Casual with friends.","watchOut":None,"examples":None,"functionCategories":["complain"],"usageSettings":[],"suitability":"expression","notExpressionReasonEn":None}
    result={"origin":"model","card":card,"promptVersion":"analyze-saved-item-v3","model":"fixture/legacy-upgrade","pin":None}
    claim=rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),"null","now()")
    remove="select to_jsonb(public.remove_vault_expression("+literal(owner)+","+literal(graph["expression"])+"));"
    return owner,source,graph,request,result,claim,remove

cleanup()
try:
    owner,source,g,request,result,claim_sql,remove=seed()
    probe="begin;select 1 from public.expression_senses where id="+literal(g["sense"])+" for update nowait;rollback;"
    race("user_expressions",g["expression"],remove,claim_sql,"owned sense not found",probe_sql=probe)
    print("PASS remove-before-claim: no sense lock before the active expression fence")
finally:
    cleanup()
for scenario in ("remove_before_publish","claim_before_remove","publish_before_remove","official_before_upgrade","upgrade_before_official"):
    cleanup()
    try:
        owner,source,g,request,result,claim_sql,remove=seed()
        if scenario in ("official_before_upgrade","upgrade_before_official"):
            task="59be0000-0000-4000-8000-000000000071"
            execute("insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,review_task_id) select "+",".join([literal(task),literal(owner),literal(g["expression"]),"'due_practice'","'en'","'zh-CN'","'高得要命'","'同事说一瓶普通矿泉水卖两百元，问你怎么看。'","'Complain about the price.'","'Use the expression.'"])+",due_at,id from public.review_tasks where id="+literal(g["review"])+";")
            score={"reviewTaskId":g["review"],"practiceTaskId":task,"responseChinese":"这个价格高得要命。","accuracyScore":4,"accuracyFeedbackEnglish":"Accurate.","naturalnessScore":4,"naturalnessFeedbackEnglish":"Natural.","contextualFitScore":4,"contextualFitFeedbackEnglish":"Fits."}
            complete=rpc("complete_due_practice_with_examples",literal(owner),json_sql(score)+"||jsonb_build_object('completedAt',now())")
        if scenario=="claim_before_remove":
            first,second=race("user_expressions",g["expression"],rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"now()"),remove,initial_sql=claim_sql)
            assert first["status"]=="in_progress" and second is True
        else:
            claimed=one(claim_sql)
            publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claimed["token"]),json_sql(result),"now()")
            if scenario=="remove_before_publish":
                probe="begin;select 1 from public.video_sources where id="+literal(source)+" for update nowait;rollback;"
                race("user_expressions",g["expression"],remove,publish,"STALE_PLAN",probe_sql=probe)
                assert one("select count(*) from public.expression_senses where id="+literal(g["sense"])+" and meaning_here is null;")==1
            elif scenario=="publish_before_remove":
                first,second=race("user_expressions",g["expression"],rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"now()"),remove,initial_sql=publish)
                assert first["status"]=="applied" and second is True
                assert one(rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"now()"))==first
            elif scenario=="official_before_upgrade":
                first,second=race("user_expressions",g["expression"],complete,publish)
                assert first["completion"]["created"] is True and second["status"]=="applied"
            else:
                first,second=race("user_expressions",g["expression"],rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"now()"),complete,initial_sql=publish)
                assert first["status"]=="applied" and second["completion"]["created"] is True
        if scenario in ("official_before_upgrade","upgrade_before_official"):
            assert one("select jsonb_build_array(mastery_state,removed_from_vault_at) from public.user_expressions where id="+literal(g["expression"])+";")==["reused",None]
            assert one("select count(*) from public.review_tasks where user_expression_id="+literal(g["expression"])+" and status='pending' and interval_days=7;")==1
        else:
            assert one("select count(*) from public.user_expressions where id="+literal(g["expression"])+" and removed_from_vault_at is not null;")==1
            assert one("select count(*) from public.review_tasks where user_expression_id="+literal(g["expression"])+" and status='pending';")==0
        print("PASS "+scenario+": no resurrection, duplicate learning event or lock inversion")
    finally:
        cleanup()
assert one("select count(*) from auth.users where id in("+OWNERS+");")==0
print("PASS guarded removal fixture cleanup completed")
