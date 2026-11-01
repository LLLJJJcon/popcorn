import { createHash } from "node:crypto";
import { z } from "zod";

import {
  TodayNextInputSchema, TodayPracticeHomeDataSchema, TodayPracticeResponseSchema,
  type TodayNextInput, type TodayPracticeItem, type TodayPracticeRecentVideo,
} from "@/contracts/today-practice";
import type { TodayPracticeRepository } from "@/server/repositories/today-practice-repository";
export type { TodayNextInput } from "@/contracts/today-practice";

/** A queue item's identity belongs to the candidate, not an artifact or round. */
export function todayCandidateItemId(userId: string, candidateKey: string): string {
  const bytes = Buffer.from(createHash("sha256")
    .update(`today-candidate-v1:${userId}:${candidateKey}`, "utf8").digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const owner = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const PAGE_SIZE = 200;

export function createTodayPracticeService(repository: TodayPracticeRepository) {
  function validate(userId: string, now: string) {
    owner.parse(userId);
    instant.parse(now);
  }
  return {
    async today(userId: string, now: string) {
      validate(userId, now);
      const summary = await repository.summary(userId, now);
      const items: TodayPracticeItem[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await repository.itemsPage(userId, now, offset, PAGE_SIZE);
        items.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      return TodayPracticeResponseSchema.parse({ summary, items });
    },
    async next(userId: string, now: string, input: TodayNextInput = {}) {
      validate(userId, now);
      return repository.next(userId, now, TodayNextInputSchema.parse(input));
    },
    async home(userId: string, now: string) {
      validate(userId, now);
      const [summary, recentVideos] = await Promise.all([
        repository.summary(userId, now), repository.recentVideos(userId, now),
      ]);
      return TodayPracticeHomeDataSchema.parse({ summary, recentVideos });
    },
    async needsAnalysisVideos(userId: string, now: string) {
      validate(userId, now);
      const videos: TodayPracticeRecentVideo[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await repository.needsAnalysisVideosPage(userId, now, offset, PAGE_SIZE);
        videos.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      return videos;
    },
  };
}
