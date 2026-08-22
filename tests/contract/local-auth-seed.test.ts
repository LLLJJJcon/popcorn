import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const seedSql = readFileSync(resolve("supabase/seed.sql"), "utf8");

function splitTopLevelSqlList(input: string) {
  const values: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === "'") {
      if (quoted && input[index + 1] === "'") {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (quoted) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;

    if (character === "," && depth === 0) {
      values.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }

  values.push(input.slice(start).trim());
  return values;
}

function parseSeedUsers() {
  const insert = seedSql.match(
    /insert into auth\.users\s*\(([\s\S]*?)\)\s*values\s*([\s\S]*?)\s*on conflict \(id\) do nothing;/,
  );

  expect(insert, "auth.users seed insert").not.toBeNull();

  const columns = splitTopLevelSqlList(insert![1]);
  const tuples = splitTopLevelSqlList(insert![2]);

  return tuples.map((tuple) => {
    expect(tuple.startsWith("(") && tuple.endsWith(")")).toBe(true);
    const values = splitTopLevelSqlList(tuple.slice(1, -1));
    expect(values).toHaveLength(columns.length);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

describe("local auth seed", () => {
  it("seeds the two fixed demo identities with GoTrue-readable workflow strings", () => {
    const users = parseSeedUsers();

    expect(users).toHaveLength(2);
    expect(users).toEqual([
      expect.objectContaining({
        id: "'00000000-0000-4000-8000-00000000a001'",
        email: "'owner-a@popcorn.test'",
        encrypted_password:
          "'$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.'",
        email_confirmed_at: "'2026-08-16 09:00:00+00'",
        confirmation_token: "''",
        recovery_token: "''",
        email_change: "''",
        email_change_token_new: "''",
      }),
      expect.objectContaining({
        id: "'00000000-0000-4000-8000-00000000b002'",
        email: "'owner-b@popcorn.test'",
        encrypted_password:
          "'$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.'",
        email_confirmed_at: "'2026-08-16 09:01:00+00'",
        confirmation_token: "''",
        recovery_token: "''",
        email_change: "''",
        email_change_token_new: "''",
      }),
    ]);
    expect(seedSql).toMatch(
      /insert into auth\.users[\s\S]*?on conflict \(id\) do nothing;/,
    );
  });
});
