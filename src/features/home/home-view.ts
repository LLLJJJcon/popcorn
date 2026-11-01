import type { TodayPracticeHomeData } from "@/contracts/today-practice";

export type HomeView = {
  readonly hasActiveGateway: boolean;
  readonly summary: TodayPracticeHomeData["summary"];
  readonly recentVideos: TodayPracticeHomeData["recentVideos"];
  readonly masteryDistribution: {
    readonly tried: number;
    readonly reused: number;
    readonly owned: number;
  };
};
