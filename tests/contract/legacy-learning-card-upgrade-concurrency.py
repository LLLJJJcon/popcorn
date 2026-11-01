#!/usr/bin/env python3
"""Real independent PostgreSQL connections; isolated synthetic 59a* owners only.

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
OWNERS = "'59a00000-0000-4000-8000-000000000001','59a00000-0000-4000-8000-000000000002'"


def execute(sql, name="review-race-inspect", check=True):
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


def race(lock_table, lock_id, winner, loser, expected_error=None, initial_sql=None):
    assert lock_table in ('expression_senses', 'video_sources', 'user_model_gateway_configs', 'transcript_segments', 'video_snapshots')
    # Hold the actual review row, not a test-only advisory lock. Confirm the
    # second real RPC waits on that row before releasing the first transaction.
    first = subprocess.Popen([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                             env={**PG_ENV, "PGAPPNAME": "review-race-first"})
    gate=initial_sql or "select 1 from public."+lock_table+" where id="+literal(lock_id)+" for update;"
    first.stdin.write("begin;set local statement_timeout='10s';"+gate+"select pg_sleep(2);" + winner + "commit;")
    first.stdin.close()
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        if execute("select exists(select 1 from pg_stat_activity where application_name='review-race-first' and wait_event='PgSleep');").stdout.strip() == "t":
            break
        time.sleep(.02)
    else:
        raise AssertionError("first connection never acquired review row")
    second = subprocess.Popen([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                              env={**PG_ENV, "PGAPPNAME": "review-race-second", "PGOPTIONS": "-c statement_timeout=10000"})
    second.stdin.write(loser)
    second.stdin.close()
    blocked = False
    while time.monotonic() < deadline:
        if execute("select exists(select 1 from pg_stat_activity where application_name='review-race-second' and wait_event_type='Lock');").stdout.strip() == "t":
            blocked = True
            break
        time.sleep(.02)
    first.wait(timeout=12)
    second.wait(timeout=12)
    first_out, first_error = first.stdout.read(), first.stderr.read()
    second_out, second_error = second.stdout.read(), second.stderr.read()
    assert blocked, "second connection must actually wait on the first review lock"
    assert first.returncode == 0, first_error
    if expected_error:
        assert second.returncode != 0 and expected_error in second_error, second_error
        return json.loads(first_out.strip().splitlines()[-1]), None
    assert second.returncode == 0, second_error
    return json.loads(first_out.strip().splitlines()[-1]), json.loads(second_out.strip().splitlines()[-1])


def cleanup():
    existing = one("select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email)),'[]'::jsonb) from auth.users where id in(" + OWNERS + ");")
    expected = {"59a00000-0000-4000-8000-000000000001": "legacy-upgrade-a@popcorn.test", "59a00000-0000-4000-8000-000000000002": "legacy-upgrade-b@popcorn.test"}
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


cleanup()
try:
    prefix=(ROOT/"supabase/tests/legacy_learning_card_upgrade.sql").read_text().split("select extensions.has_function('public','read_legacy_learning_card_upgrade_context'")[0]
    prefix=prefix.replace("599","59a").replace("select extensions.no_plan();","")
    prefix="\n".join(line for line in prefix.splitlines() if not line.startswith("select extensions.is("))
    execute(prefix+"commit;")
    owner="59a00000-0000-4000-8000-000000000001"
    source="59a10000-0000-4000-8000-000000000001"
    sense=one("select to_jsonb(id) from public.expression_senses where user_id="+literal(owner)+" and video_source_id="+literal(source)+";")
    context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(sense),"0","200"))
    proof=context["sources"][0]
    request={"requestId":"59af0000-0000-4000-8000-000000000001","senseId":sense,"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
    claim=one(rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),"null","'2026-11-01T00:00:00Z'"))
    card={"meaningHere":"The price is excessively high.","useItWhen":"When complaining about excessive prices.","comparedWith":"很高 is neutral.","howItFits":"After an adjective.","toneAndWho":"Casual with friends.","watchOut":None,"examples":None,"functionCategories":["complain"],"usageSettings":[],"suitability":"expression","notExpressionReasonEn":None}
    result={"origin":"model","card":card,"promptVersion":"analyze-saved-item-v3","model":"fixture/legacy-upgrade","pin":None}
    publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claim["token"]),json_sql(result),"'2026-11-01T00:00:02Z'")
    delete="select to_jsonb(d) from public.delete_video_source("+",".join([literal(owner),literal(source),"'remove_source_keep_evidence'","'2026-11-01T00:00:01Z'"])+") d;"
    race("video_sources",source,delete,publish,"STALE_PLAN")
    assert one("select count(*) from public.expression_senses where user_id="+literal(owner)+" and id="+literal(sense)+" and video_source_id is null and meaning_here is null;")==1
    print("PASS actual source deletion wins without deadlock or metadata publication")
finally:
    cleanup()
try:
    execute(prefix+"commit;")
    sense=one("select to_jsonb(id) from public.expression_senses where user_id="+literal(owner)+" and video_source_id="+literal(source)+";")
    context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(sense),"0","200"));proof=context["sources"][0]
    request={**request,"senseId":sense,"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
    config="59ae0000-0000-4000-8000-000000000001"
    execute(rpc("create_user_model_gateway_config",literal(owner),literal(config),"'https://models.example.com'","'/v1'","'Synthetic upgrade gateway'","'upgrade-test-model'","'inert-fixture-key'","'2026-11-01T00:00:00Z'"))
    execute(rpc("activate_user_model_gateway_config",literal(owner),literal(config),"'https://models.example.com/v1'","'model-egress-v1'","'2026-11-01T00:00:01Z'"))
    pin=one("select jsonb_build_object('configId',config_id,'revision',revision,'fingerprint',config_fingerprint) from public.resolve_active_user_model_gateway_pin("+literal(owner)+");")
    claim=one(rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),json_sql(pin),"'2026-11-01T00:00:02Z'"))
    result={**result,"pin":pin,"model":"upgrade-test-model"}
    publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claim["token"]),json_sql(result),"'2026-11-01T00:00:04Z'")
    revoke="select to_jsonb(public.revoke_user_model_gateway_config("+",".join([literal(owner),literal(config),"'2026-11-01T00:00:03Z'"])+"));"
    race("user_model_gateway_configs",config,revoke,publish,"GATEWAY_CHANGED")
    assert one("select count(*) from public.expression_senses where user_id="+literal(owner)+" and id="+literal(sense)+" and meaning_here is null;")==1
    print("PASS an in-flight consent revocation fences metadata publication")
finally:
    cleanup()
try:
    execute(prefix+"commit;")
    sense=one("select to_jsonb(id) from public.expression_senses where user_id="+literal(owner)+" and video_source_id="+literal(source)+";")
    context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(sense),"0","200"));proof=context["sources"][0]
    request={**request,"senseId":sense,"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
    claim=one(rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),"null","'2026-11-01T00:00:00Z'"))
    result={**result,"pin":None,"model":"fixture/legacy-upgrade"}
    publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claim["token"]),json_sql(result),"'2026-11-01T00:00:02Z'")
    segment=one("select to_jsonb(id) from public.transcript_segments where user_id="+literal(owner)+" and snapshot_id="+literal(proof["snapshotId"])+" and stable_id='history-segment';")
    edit="update public.transcript_segments set original_chinese='这里的新价格高得要命。' where user_id="+literal(owner)+" and id="+literal(segment)+" returning to_jsonb(id);"
    race("transcript_segments",segment,edit,publish,"STALE_PLAN")
    assert one("select count(*) from public.expression_senses where user_id="+literal(owner)+" and id="+literal(sense)+" and meaning_here is null;")==1
    print("PASS an in-flight subtitle edit fences metadata publication")
finally:
    cleanup()
try:
    execute(prefix+"commit;")
    sense=one("select to_jsonb(id) from public.expression_senses where user_id="+literal(owner)+" and video_source_id="+literal(source)+";")
    context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(sense),"0","200"));proof=context["sources"][0]
    request={**request,"senseId":sense,"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
    claim=one(rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),"null","'2026-11-01T00:00:00Z'"))
    publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claim["token"]),json_sql(result),"'2026-11-01T00:00:02Z'")
    insert="insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language) values("+",".join([literal(owner),literal(proof["snapshotId"]),"'new-neighbor'","1","'新的邻接上下文。'","3","4","'zh-CN'"])+");"
    race("video_snapshots",proof["snapshotId"],"select 'true'::jsonb;",publish,"STALE_PLAN",initial_sql=insert)
    assert one("select count(*) from public.expression_senses where user_id="+literal(owner)+" and id="+literal(sense)+" and meaning_here is null;")==1
    print("PASS an earlier neighbor INSERT is fenced by its actual snapshot foreign-key lock")
finally:
    cleanup()
for scenario in ("neighbor_after_publish", "edit_after_publish", "delete_after_publish", "same_request_publish", "revoke_after_publish"):
    try:
        execute(prefix+"commit;")
        sense=one("select to_jsonb(id) from public.expression_senses where user_id="+literal(owner)+" and video_source_id="+literal(source)+";")
        context=one(rpc("read_legacy_learning_card_upgrade_context",literal(owner),literal(sense),"0","200"));proof=context["sources"][0]
        request={**request,"senseId":sense,"expectedBeforeHash":context["beforeHash"],"expectedEvidenceHash":proof["evidenceHash"],"source":{"kind":"source_occurrence","sourceId":source,"snapshotId":proof["snapshotId"],"occurrenceId":proof["occurrenceId"]}}
        pin=None;model="fixture/legacy-upgrade"
        if scenario=="revoke_after_publish":
            execute(rpc("create_user_model_gateway_config",literal(owner),literal(config),"'https://models.example.com'","'/v1'","'Synthetic upgrade gateway'","'upgrade-test-model'","'inert-fixture-key'","'2026-11-01T00:00:00Z'"))
            execute(rpc("activate_user_model_gateway_config",literal(owner),literal(config),"'https://models.example.com/v1'","'model-egress-v1'","'2026-11-01T00:00:00Z'"))
            pin=one("select jsonb_build_object('configId',config_id,'revision',revision,'fingerprint',config_fingerprint) from public.resolve_active_user_model_gateway_pin("+literal(owner)+");");model="upgrade-test-model"
        claim=one(rpc("claim_legacy_learning_card_upgrade",literal(owner),json_sql(request),json_sql(pin),"'2026-11-01T00:00:00Z'"))
        result={**result,"pin":pin,"model":model}
        publish=rpc("publish_legacy_learning_card_upgrade",literal(owner),json_sql(request),literal(claim["token"]),json_sql(result),"'2026-11-01T00:00:02Z'")
        if scenario=="neighbor_after_publish":
            second="insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language) values("+",".join([literal(owner),literal(proof["snapshotId"]),"'new-neighbor'","1","'新的邻接上下文。'","3","4","'zh-CN'"])+") returning to_jsonb(id);"
            first,after=race("video_snapshots",proof["snapshotId"],publish,second)
        elif scenario=="edit_after_publish":
            segment=one("select to_jsonb(id) from public.transcript_segments where user_id="+literal(owner)+" and snapshot_id="+literal(proof["snapshotId"])+" and stable_id='history-segment';")
            second="update public.transcript_segments set original_chinese='这里的新价格高得要命。' where user_id="+literal(owner)+" and id="+literal(segment)+" returning to_jsonb(id);"
            first,after=race("transcript_segments",segment,publish,second)
        elif scenario=="delete_after_publish":
            second="select to_jsonb(d) from public.delete_video_source("+",".join([literal(owner),literal(source),"'remove_source_keep_evidence'","'2026-11-01T00:00:03Z'"])+") d;"
            first,after=race("video_sources",source,publish,second)
        elif scenario=="revoke_after_publish":
            second="select to_jsonb(public.revoke_user_model_gateway_config("+",".join([literal(owner),literal(config),"'2026-11-01T00:00:03Z'"])+"));"
            first,after=race("user_model_gateway_configs",config,publish,second)
        else:
            # The first real publication owns its normal source->evidence->sense
            # locks until commit. Do not inject an inverted sense-first gate.
            first,after=race("video_sources",source,rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"'2026-11-01T00:00:03Z'"),publish,initial_sql=publish)
            assert first==after
        assert first["status"]=="applied"
        replay=one(rpc("lookup_legacy_learning_card_upgrade",literal(owner),json_sql(request),"'2026-11-01T00:00:05Z'"))
        assert replay==first
        print("PASS "+scenario+": exact applied receipt stays immutable")
    finally:
        cleanup()
try:
    execute(prefix+"commit;")
    integration=subprocess.run(["node","--import","tsx",str(ROOT/"tests/contract/legacy-learning-card-upgrade-runtime.ts")],text=True,capture_output=True,cwd=ROOT)
    assert integration.returncode==0,integration.stderr
    print(integration.stdout.strip())
finally:
    cleanup()
assert one("select count(*) from auth.users where id in("+OWNERS+");")==0
print("PASS guarded fixture cleanup completed")
