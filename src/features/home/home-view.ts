import type { SavedVideoSummary } from "@/features/saved/api";

export type HomeView = {
  readonly hasActiveGateway: boolean;
  readonly duePracticeCount: number;
  readonly unsortedSaveCount: number;
  readonly recentVideo: SavedVideoSummary | null;
  readonly masteryDistribution: {
    readonly tried: number;
    readonly reused: number;
    readonly owned: number;
  };
};
