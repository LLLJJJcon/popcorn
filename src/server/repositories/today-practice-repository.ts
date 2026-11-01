import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  TodayPracticeSummarySchema, TodayPracticeItemSchema,
  TodayPracticeNextResponseSchema, TodayPracticeRecentVideoSchema,
  type TodayPracticeSummary, type TodayPracticeItem,
  type TodayPracticeNextResponse, type TodayPracticeRecentVideo, type TodayNextInput,
} from "@/contracts/today-practice";
import type { Database } from "@/types/database.generated";

export interface TodayPracticeRepository {
  summary(userId: string, now: string): Promise<TodayPracticeSummary>;
  itemsPage(userId: string, now: string, offset: number, limit: number): Promise<TodayPracticeItem[]>;
  next(userId: string, now: string, input: TodayNextInput): Promise<TodayPracticeNextResponse>;
  recentVideos(userId: string, now: string): Promise<TodayPracticeRecentVideo[]>;
  needsAnalysisVideosPage(userId: string, now: string, offset: number, limit: number): Promise<TodayPracticeRecentVideo[]>;
}

/** Each RPC scopes every underlying relation by the authenticated owner. */
export function createTodayPracticeRepository(client: SupabaseClient<Database>): TodayPracticeRepository {
  const args = (userId: string, now: string) => ({ p_user_id: userId, p_now: now });
  function data<T>(result: { data: T; error: unknown }): T {
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    async summary(userId, now) {
      return TodayPracticeSummarySchema.parse(data(await client.rpc("get_today_practice_summary", args(userId, now))));
    },
    async itemsPage(userId, now, offset, limit) {
      return z.array(TodayPracticeItemSchema).parse(data(await client.rpc("list_today_practice_items", {
        ...args(userId, now), p_offset: offset, p_limit: limit,
      })));
    },
    async next(userId, now, input) {
      return TodayPracticeNextResponseSchema.parse(data(await client.rpc("get_today_practice_next", {
        ...args(userId, now), p_exclude: input.exclude ?? [],
        p_current_item_id: input.currentItemId ?? null, p_current_task_id: input.currentTaskId ?? null,
      })));
    },
    async recentVideos(userId, now) {
      return z.array(TodayPracticeRecentVideoSchema).parse(data(await client.rpc("list_today_practice_videos", {
        ...args(userId, now), p_needs_analysis_only: false, p_offset: 0, p_limit: 3,
      })));
    },
    async needsAnalysisVideosPage(userId, now, offset, limit) {
      return z.array(TodayPracticeRecentVideoSchema).parse(data(await client.rpc("list_today_practice_videos", {
        ...args(userId, now), p_needs_analysis_only: true, p_offset: offset, p_limit: limit,
      })));
    },
  };
}
