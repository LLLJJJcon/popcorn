import { existsSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

import { AppShell } from "./app-shell";
import { GatewayNotice } from "./gateway-notice";

const navigationHarness = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/saved/video-123"),
}));

vi.mock("next/navigation", () => ({ usePathname: navigationHarness.usePathname }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("provides accessible workspace navigation and account controls around page content", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      ok: true,
      data: {
        configs: [{
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          displayName: "Study Gateway",
          baseUrl: "https://gateway.example.com/v1",
          model: "mandarin-model",
          revision: 1,
          configFingerprint: "a".repeat(64),
          state: "active",
          consent: {
            exactBaseUrl: "https://gateway.example.com/v1",
            policyVersion: "model-egress-v1",
            consentedAt: "2026-09-05T00:00:00.000Z",
          },
          hasApiKey: true,
          createdAt: "2026-09-05T00:00:00.000Z",
          updatedAt: "2026-09-05T00:00:00.000Z",
        }],
      },
      requestId: "request-safe",
    })));

    render(
      <AppShell account={{ email: "learner@example.com" }}>
        <main><h1>Saved video</h1></main>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation).getByRole("link", { name: "Saved" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings/model-gateway",
    );
    expect(document.querySelector("#main-content > main")).toBeInTheDocument();
    expect(screen.getByText("learner@example.com")).toBeInTheDocument();
    const signOut = screen.getByRole("form", { name: "Sign out of Popcorn" });
    expect(signOut).toHaveAttribute("action", "/auth/sign-out");
    expect(signOut).toHaveAttribute("method", "post");
    expect(within(signOut).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("uses a neutral account summary when no verified email is available", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(<AppShell account={{}}><main>Content</main></AppShell>);

    expect(screen.getByText("Popcorn account")).toBeInTheDocument();
  });

  it("keeps exactly one model-gateway page at its route-group location", () => {
    const appDirectory = join(process.cwd(), "src/app");

    expect(existsSync(join(appDirectory, "(app)/settings/model-gateway/page.tsx"))).toBe(true);
    expect(existsSync(join(appDirectory, "settings/model-gateway/page.tsx"))).toBe(false);
  });
});

describe("GatewayNotice", () => {
  it("offers one settings action after an empty gateway response without exposing response metadata", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      ok: true,
      data: { configs: [] },
      requestId: "request-must-not-be-rendered",
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GatewayNotice />);

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Set up a model gateway");
    expect(within(notice).getAllByRole("link")).toHaveLength(1);
    expect(within(notice).getByRole("link", { name: "Open Settings" })).toHaveAttribute(
      "href",
      "/settings/model-gateway",
    );
    expect(notice).not.toHaveTextContent("request-must-not-be-rendered");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/settings/model-gateway", {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("stays hidden for malformed successful envelopes and settings payloads", async () => {
    const malformedResponses = [
      { data: { configs: [] }, requestId: "missing-ok" },
      {
        ok: true,
        data: { configs: [{ state: "pending_consent" }] },
        requestId: "incomplete-config",
      },
    ];

    for (const payload of malformedResponses) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload)));
      const view = render(<GatewayNotice />);

      await expect(screen.findByRole("status", {}, { timeout: 250 })).rejects.toThrow();

      view.unmount();
    }
  });
});
