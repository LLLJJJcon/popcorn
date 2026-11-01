import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createTodayPracticeService } from "@/server/domain/build-today-queue";
import { createTodayPracticeRepository } from "@/server/repositories/today-practice-repository";
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

type HomeGatewayRepository = {
  readonly listConfigs: (userId: string) => Promise<readonly { readonly state: string }[]>;
};

type HomeLoaderDependencies = {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly today: Pick<ReturnType<typeof createTodayPracticeService>, "home">;
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

    const [today, progress, configs] = await Promise.all([
      dependencies.today.home(session.userId, now),
      dependencies.progress.read(session.userId, now),
      dependencies.gateways.listConfigs(session.userId),
    ]);

    return {
      ok: true,
      view: {
        hasActiveGateway: configs.some(({ state }) => state === "active"),
        summary: today.summary,
        recentVideos: today.recentVideos,
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
    today: createTodayPracticeService(createTodayPracticeRepository(client)),
    progress: createProgressRepository(createSupabaseProgressEvidenceSource(client)),
    gateways: createModelGatewaySettingsRepository(client),
  });

  return { appUrl: environment.APP_URL, load };
}
