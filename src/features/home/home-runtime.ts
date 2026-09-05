import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  createSavedLibraryRepository,
  createSavedLibraryService,
  type SavedVideoSummary,
} from "@/features/saved/api";
import type { HomeView } from "@/features/home/home-view";
import {
  createNextCookieAdapter,
  createWebSessionAuthenticator,
  type WebSessionResult,
} from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createModelGatewaySettingsRepository } from "@/server/repositories/model-gateway-settings-repository";
import {
  createProgressRepository,
  createSupabaseProgressEvidenceSource,
  type ProgressRepository,
} from "@/server/repositories/progress-repository";
import type { Database } from "@/types/database.generated";

type HomeSavedService = {
  readonly home: (userId: string, now: string) => Promise<{
    readonly duePracticeCount: number;
    readonly unsortedSaveCount: number;
  }>;
  readonly list: (userId: string) => Promise<readonly SavedVideoSummary[]>;
};

type HomeGatewayRepository = {
  readonly listConfigs: (userId: string) => Promise<readonly { readonly state: string }[]>;
};

type HomeLoaderDependencies = {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly saved: HomeSavedService;
  readonly progress: ProgressRepository;
  readonly gateways: HomeGatewayRepository;
};

export type HomeLoadResult =
  | { readonly ok: false; readonly reason: "missing" | "expired" }
  | { readonly ok: true; readonly view: HomeView };

export function createHomeLoader(dependencies: HomeLoaderDependencies) {
  return async (request: Request, now: string): Promise<HomeLoadResult> => {
    const session = await dependencies.authenticate(request);
    if (!session.ok) return session;

    const [counts, videos, progress, configs] = await Promise.all([
      dependencies.saved.home(session.userId, now),
      dependencies.saved.list(session.userId),
      dependencies.progress.read(session.userId, now),
      dependencies.gateways.listConfigs(session.userId),
    ]);

    return {
      ok: true,
      view: {
        hasActiveGateway: configs.some(({ state }) => state === "active"),
        duePracticeCount: counts.duePracticeCount,
        unsortedSaveCount: counts.unsortedSaveCount,
        recentVideo: videos[0] ?? null,
        masteryDistribution: progress.masteryDistribution,
      },
    };
  };
}

export async function createHomeRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const cookieStore = await cookies();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(cookieStore),
  });
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const load = createHomeLoader({
    authenticate,
    saved: createSavedLibraryService(createSavedLibraryRepository(client)),
    progress: createProgressRepository(createSupabaseProgressEvidenceSource(client)),
    gateways: createModelGatewaySettingsRepository(client),
  });

  return { appUrl: environment.APP_URL, load };
}
