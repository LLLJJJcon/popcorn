// @vitest-environment node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

test("exports loadable fixture settings even when pnpm emits install status messages", async () => {
  const workflow = await readFile(path.resolve(".github/workflows/ci.yml"), "utf8");
  const step = workflow.split("      - name: Export local fixture settings")[1]?.split("      - name:")[0];
  const script = step?.split("        run: |\n")[1]?.split("\n").map((line) => line.replace(/^          /, "")).join("\n");
  if (!script) throw new Error("fixture export step is missing");
  const directory = await mkdtemp(path.join(tmpdir(), "popcorn-ci-export-"));
  try {
    await mkdir(path.join(directory, "node_modules/.bin"), { recursive: true });
    await mkdir(path.join(directory, "bin"));
    await writeFile(path.join(directory, "node_modules/.bin/supabase"), `#!/bin/bash
cat <<'ENV'
API_URL="http://127.0.0.1:54321"
ANON_KEY="fixture-anon"
SERVICE_ROLE_KEY="fixture-service"
DB_URL="postgresql://fixture@127.0.0.1:54322/postgres"
ENV
`, { mode: 0o755 });
    await writeFile(path.join(directory, "bin/pnpm"), `#!/bin/bash
echo 'Already up to date'
node_modules/.bin/supabase status -o env
`, { mode: 0o755 });
    const environmentFile = path.join(directory, "github.env");
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c",
      script.replaceAll("/tmp/popcorn-supabase.env", path.join(directory, "supabase.env")),
    ], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PATH: `${path.join(directory, "bin")}:${process.env.PATH}`, GITHUB_ENV: environmentFile },
    });

    expect(result.status, result.stderr).toBe(0);
    expect((await readFile(environmentFile, "utf8")).trim().split("\n")).toEqual([
      "APP_URL=http://127.0.0.1:3000",
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon",
      "SUPABASE_SERVICE_ROLE_KEY=fixture-service",
      "POPCORN_E2E_DATABASE_URL=postgresql://fixture@127.0.0.1:54322/postgres",
      "INTERNAL_JOB_SECRET=fixture-job-secret",
    ]);
    expect(result.stdout).not.toContain("fixture-service");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
