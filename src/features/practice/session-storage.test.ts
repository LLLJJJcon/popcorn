import { afterEach, expect, test, vi } from "vitest";
import { readSession, writeSession, upsertSessionResult } from "./session-storage";
const result = { id: "00000000-0000-4000-8000-000000000001", kind: "new" as const, expression: "太离谱了", outcome: "practice_again_tomorrow" as const, priorMastery: null, newMastery: null, nextPracticeAt: null };
afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});
test("storage is versioned, owner scoped, validates corruption and remains optional", () => {
  const value = { results: [result], current: null };
  writeSession("one", value);
  expect(readSession("one").results).toEqual([result]);
  expect(readSession("two").results).toEqual([]);
  sessionStorage.setItem("popcorn:today-session:v1:one", "{bad");
  expect(readSession("one").results).toEqual([]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => readSession("one")).not.toThrow();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => writeSession("one", value)).not.toThrow();
});
test("same candidate result replaces across rounds rather than duplicating", () => {
  expect(upsertSessionResult([result], { ...result, outcome: "added", newMastery: "tried" })).toHaveLength(1);
});
test("wrong version or owner never restores display data", () => {
  sessionStorage.setItem("popcorn:today-session:v1:one", JSON.stringify({ version: 2, userId: "one", results: [result], current: null }));
  expect(readSession("one").results).toEqual([]);
  sessionStorage.setItem("popcorn:today-session:v1:one", JSON.stringify({ version: 1, userId: "two", results: [result], current: null }));
  expect(readSession("one").results).toEqual([]);
});
test("duplicate stable IDs in readable storage cannot double-count a session", () => {
  writeSession("one", { results: [result, { ...result, outcome: "added", newMastery: "tried" }], current: null });
  expect(readSession("one").results).toHaveLength(1);
  expect(readSession("one").results[0]!.outcome).toBe("added");
  expect(upsertSessionResult([result, result], { ...result, outcome: "removed" })).toHaveLength(1);
});
