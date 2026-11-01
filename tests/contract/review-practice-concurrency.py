#!/usr/bin/env python3
"""Real independent PostgreSQL connections; isolated synthetic 597* owners only.

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
OWNERS = "'59700000-0000-4000-8000-000000000001','59700000-0000-4000-8000-000000000002'"


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


def race(review_id, winner, loser, expected_error=None):
    # Hold the actual review row, not a test-only advisory lock. Confirm the
    # second real RPC waits on that row before releasing the first transaction.
    first = subprocess.Popen([PSQL, "-XAtq", "-v", "ON_ERROR_STOP=1"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                             env={**PG_ENV, "PGAPPNAME": "review-race-first"})
    first.stdin.write("begin;set local statement_timeout='10s';select 1 from public.review_tasks where id=" + literal(review_id) + " for update;select pg_sleep(2);" + winner + "commit;")
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
    expected = {"59700000-0000-4000-8000-000000000001": "review-completion-a@popcorn.test", "59700000-0000-4000-8000-000000000002": "review-completion-b@popcorn.test"}
    assert all(expected.get(row["id"]) == row["email"] for row in existing), "reserved account is not this harness fixture; cleanup aborted"
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


def generated(zh):
    return {"scenario": {"situationZh": zh, "situationEn": "A colleague asks about an unexpectedly expensive service.", "interlocutor": "同事", "taskEn": "Complain about the excessive price."},
            "targetFunction": {"value": "complain"}, "targetSetting": {"value": "work_school"}, "transferType": "near", "promptVersion": "transfer-scenario-v1", "model": "fixture/concurrency", "pin": None}


def identity(owner, review, request):
    return one("select jsonb_build_object('taskId',id,'scenarioVersion',scenario_version,'scenarioFingerprint',scenario_fingerprint,'requestId'," + literal(request) + ") from public.practice_tasks where user_id=" + literal(owner) + " and review_task_id=" + literal(review) + ";")


def publish_scenario(owner, review, claim, zh, clock="2026-11-01T00:01:00Z"):
    return rpc("publish_review_scenario", literal(owner), literal(review), literal(claim["requestId"]), literal(claim["token"]), json_sql(generated(zh)), literal(clock))


cleanup()
try:
    prefix = (ROOT / "supabase/tests/review_completion_requests.sql").read_text().split("create temp table completion_results")[0]
    prefix = prefix.replace("595", "597").replace("select extensions.no_plan();", "")
    # The no-residue assertion is a test statement, not fixture setup.
    prefix = "\n".join(line for line in prefix.splitlines() if not line.startswith("select extensions.is("))
    execute(prefix + "commit;")
    graphs = one("select jsonb_agg(jsonb_build_object('owner',user_id,'review',id)) from public.review_tasks where user_id in(" + OWNERS + ") order by 1;")
    owner, review = graphs[0]["owner"], graphs[0]["review"]
    job = one("update public.knowledge_jobs set status='leased',attempt_count=1,lease_expires_at='2026-11-01T00:05:00Z' where id=(select j.id from public.knowledge_jobs j join public.knowledge_job_internal i on i.knowledge_job_id=j.id where j.user_id=" + literal(owner) + " and i.input->>'reviewTaskId'=" + literal(review) + ") returning jsonb_build_object('jobId',id,'attemptCount',attempt_count,'leaseExpiresAt',lease_expires_at);")
    background = rpc("claim_review_preparation", literal(owner), literal(review), "'prepare'", literal(job["jobId"]), "null", json_sql(job), "'2026-11-01T00:00:00Z'")
    foreground = rpc("claim_review_preparation", literal(owner), literal(review), "'prepare'", "null", "null", "null", "'2026-11-01T00:00:01Z'")
    claimed, observed = race(review, background, foreground)
    assert claimed["kind"] == "claimed" and observed["kind"] == "pending"
    assert one("select count(*) from private.review_operations where user_id=" + literal(owner) + " and review_task_id=" + literal(review) + " and status='claimed';") == 1
    execute(publish_scenario(owner, review, claimed, "朋友问这次修理普通水杯收两百元怎么样。"))
    print("PASS worker/GET real row-lock contention yields one model-cycle claim")

    request = "597f0000-0000-4000-8000-000000000001"
    answer = {**identity(owner, review, request), "responseChinese": "这个价格高得要命。"}
    complete_claim = rpc("claim_review_completion", literal(owner), literal(review), json_sql(answer), "'2026-11-01T00:02:00Z'")
    completion, pending = race(review, complete_claim, complete_claim)
    assert completion["kind"] == "claimed" and pending["kind"] == "pending"
    print("PASS same-request official scoring contention yields one model-cycle claim")
    regen_input = identity(owner, review, "597f0000-0000-4000-8000-000000000002")
    regeneration = one(rpc("claim_review_preparation", literal(owner), literal(review), "'regenerate'", literal(regen_input["requestId"]), json_sql(regen_input), "null", "'2026-11-01T00:02:01Z'"))
    scored = {"evaluation": {"passed": True, "independentUse": True, "assistanceLevel": "none", **{key: {"score": 4, "englishFeedback": "Appropriate."} for key in ("accuracy", "naturalness", "contextualFit")}}, "coaching": None, "model": "fixture/concurrency", "pin": None, "promptVersion": "evaluate-practice-v5", "submittedAt": "2026-11-01T00:02:00.000Z"}
    publish_complete = rpc("publish_review_completion", literal(owner), literal(review), json_sql(answer), literal(completion["token"]), json_sql(scored), "'2026-11-01T00:02:03Z'")
    race(review, publish_scenario(owner, review, regeneration, "同事问一页普通打印收费五十元是否合理。", "2026-11-01T00:02:03Z"), publish_complete, "SCENARIO_CHANGED")
    assert one("select count(*) from private.due_practice_completion_receipts where user_id=" + literal(owner) + " and review_task_id=" + literal(review) + ";") == 0
    print("PASS committed regeneration fences a waiting old-question official publisher")

    owner2, review2 = graphs[1]["owner"], graphs[1]["review"]
    initial = one(rpc("claim_review_preparation", literal(owner2), literal(review2), "'prepare'", "null", "null", "null", "'2026-11-01T00:00:00Z'"))
    execute(publish_scenario(owner2, review2, initial, "家人问普通午餐一份两百元怎么样。"))
    answer2 = {**identity(owner2, review2, "597f0000-0000-4000-8000-000000000003"), "responseChinese": "这个价格高得要命。"}
    completing = one(rpc("claim_review_completion", literal(owner2), literal(review2), json_sql(answer2), "'2026-11-01T00:02:00Z'"))
    regen2 = identity(owner2, review2, "597f0000-0000-4000-8000-000000000004")
    replacing = one(rpc("claim_review_preparation", literal(owner2), literal(review2), "'regenerate'", literal(regen2["requestId"]), json_sql(regen2), "null", "'2026-11-01T00:02:01Z'"))
    winner = rpc("publish_review_completion", literal(owner2), literal(review2), json_sql(answer2), literal(completing["token"]), json_sql(scored), "'2026-11-01T00:02:03Z'")
    race(review2, winner, publish_scenario(owner2, review2, replacing, "朋友问新咖啡杯卖五百元怎么样。", "2026-11-01T00:02:04Z"), "ALREADY_SUBMITTED")
    assert one("select count(*) from private.due_practice_completion_receipts where user_id=" + literal(owner2) + " and review_task_id=" + literal(review2) + ";") == 1
    print("PASS committed official answer fences a waiting regeneration publisher")
    execute("select public.delete_video_source(" + literal(owner2) + ",s.video_source_id,'remove_source_keep_evidence','2026-11-01T00:03:00Z') from public.review_tasks r join public.user_expressions e on e.id=r.user_expression_id join public.expression_senses s on s.id=e.expression_sense_id where r.id=" + literal(review2) + ";")
    replay = subprocess.run(["node", "--import", "tsx", str(ROOT / "tests/contract/review-official-replay.ts"), owner2, review2], text=True, capture_output=True, cwd=ROOT)
    assert replay.returncode == 0, replay.stderr
    print(replay.stdout.strip())
finally:
    cleanup()
assert one("select count(*) from auth.users where id in(" + OWNERS + ");") == 0
print("PASS synthetic fixture cleanup completed")
