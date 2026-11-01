import { z } from "zod";
import { TodaySessionResultSchema, type TodaySessionResult } from "@/contracts/today-practice";
const HintSchema = z.object({ currentItemId: z.string().uuid(), currentTaskId: z.string().uuid() });
const ValueSchema = z.object({ version: z.literal(1), userId: z.string(), results: z.array(TodaySessionResultSchema), current: HintSchema.nullable(), finished: z.boolean().default(false) });
export type SessionHint = z.infer<typeof HintSchema>;
export type SessionDisplay = {
  results: TodaySessionResult[];
  current: SessionHint | null;
  finished?: boolean;
};
const empty = (): SessionDisplay => ({ results: [], current: null });
const key = (userId: string) => `popcorn:today-session:v1:${encodeURIComponent(userId)}`;
export function readSession(userId: string): SessionDisplay {
  try {
    const raw = sessionStorage.getItem(key(userId));
    if (!raw)
      return empty();
    const parsed = ValueSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.userId === userId ? { results: Array.from(new Map(parsed.data.results.map(result => [result.id, result])).values()), current: parsed.data.current, finished: parsed.data.finished } : empty();
  }
  catch {
    return empty();
  }
}
export function writeSession(userId: string, value: SessionDisplay): void {
  try {
    sessionStorage.setItem(key(userId), JSON.stringify({ ...value, version: 1, userId }));
  }
  catch { /* Optional display and navigation storage. */ }
}
export function upsertSessionResult(results: readonly TodaySessionResult[], result: TodaySessionResult): TodaySessionResult[] {
  const byId = new Map(results.map(value => [value.id, value]));
  byId.set(result.id, result);
  return Array.from(byId.values());
}
