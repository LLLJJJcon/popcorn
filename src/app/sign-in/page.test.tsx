import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import SignInPage from "./page";

const getPageAccount = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("@/server/env", () => ({
  getModelGatewaySettingsEnv: vi.fn(() => ({
    APP_URL: "https://popcorn.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  })),
}));

vi.mock("@/server/auth/web-auth-flow", () => ({
  createWebAuthFlowHandlers: vi.fn(() => ({ getPageAccount })),
}));

describe("SignInPage", () => {
  beforeEach(() => {
    getPageAccount.mockReset();
  });

  it("keeps Popcorn's learning purpose beside a clearly labelled local-account form for anonymous and expired sessions", async () => {
    getPageAccount.mockResolvedValue({ authenticated: false });

    render(await SignInPage());

    const purpose = screen.getByRole("complementary", { name: "Turn the YouTube videos you watch into Mandarin practice." });
    expect(purpose).toHaveTextContent("Turn the YouTube videos you watch into Mandarin practice.");

    const account = screen.getByRole("region", { name: "Local Popcorn account" });
    expect(within(account).getByRole("form", { name: "Email and password sign in" })).toBeInTheDocument();
    expect(within(account).getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(within(account).getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("renders only the signed-in account state for a verified user", async () => {
    getPageAccount.mockResolvedValue({ authenticated: true, email: "learner@example.com" });

    render(await SignInPage());

    const account = screen.getByRole("region", { name: "Local Popcorn account" });
    expect(within(account).getByText("Signed in as learner@example.com.")).toBeInTheDocument();
    expect(within(account).getByRole("link", { name: "Continue to Popcorn" })).toHaveAttribute(
      "href",
      "/home",
    );
    const signOutForm = within(account).getByRole("form", { name: "Sign out of Popcorn" });
    expect(signOutForm).toHaveAttribute("action", "/auth/sign-out");
    expect(signOutForm).toHaveAttribute("method", "post");
    expect(within(signOutForm).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(within(account).queryByRole("textbox", { name: /email/i })).not.toBeInTheDocument();
    expect(within(account).queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(within(account).queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
    expect(within(account).queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("uses a neutral account label when the verified user has no email", async () => {
    getPageAccount.mockResolvedValue({ authenticated: true });

    render(await SignInPage());

    expect(screen.getByText("Signed in as Popcorn account.")).toBeInTheDocument();
  });
});
