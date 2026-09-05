import { vi } from "vitest";

import RootPage from "./page";

const pageHarness = vi.hoisted(() => ({
  getPageAccount: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("next/navigation", () => ({ redirect: pageHarness.redirect }));

vi.mock("@/server/env", () => ({
  getModelGatewaySettingsEnv: vi.fn(() => ({
    APP_URL: "https://popcorn.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  })),
}));

vi.mock("@/server/auth/web-auth-flow", () => ({
  createWebAuthFlowHandlers: vi.fn(() => ({ getPageAccount: pageHarness.getPageAccount })),
}));

describe("RootPage", () => {
  beforeEach(() => {
    pageHarness.getPageAccount.mockReset();
    pageHarness.redirect.mockReset();
  });

  it("sends an anonymous visitor to sign in", async () => {
    pageHarness.getPageAccount.mockResolvedValue({ authenticated: false });

    await RootPage();

    expect(pageHarness.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("sends an authenticated learner to Home", async () => {
    pageHarness.getPageAccount.mockResolvedValue({ authenticated: true, email: "learner@example.com" });

    await RootPage();

    expect(pageHarness.redirect).toHaveBeenCalledWith("/home");
  });
});
