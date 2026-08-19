import { readFile } from "node:fs/promises";
import path from "node:path";

describe("model gateway Web authentication wiring", () => {
  it("keeps auth routes server-only and delegates to the shared Web auth flow", async () => {
    const roots = [
      "src/app/auth/sign-in/route.ts",
      "src/app/auth/callback/route.ts",
      "src/app/auth/sign-out/route.ts",
    ];
    for (const file of roots) {
      const source = await readFile(path.resolve(file), "utf8");
      expect(source).not.toContain('"use client"');
      expect(source).toContain("createWebAuthFlowHandlers");
      expect(source).not.toMatch(/redirectTo|callbackUrl|next\s*:/);
    }
  });

  it("authorizes the settings page with verified getUser through the shared SSR client", async () => {
    const pageSource = await readFile(path.resolve("src/app/settings/model-gateway/page.tsx"), "utf8");
    const flowSource = await readFile(path.resolve("src/server/auth/web-auth-flow.ts"), "utf8");
    expect(pageSource).toContain("getPageAuthorization");
    expect(pageSource).toContain('redirect("/sign-in")');
    expect(pageSource).not.toMatch(/user\.id|userId|email/);
    expect(flowSource).toContain("createPopcornSsrServerClient");
    expect(flowSource).toContain("createNextCookieAdapter");
    expect(flowSource).toContain("auth.getUser()");
    expect(flowSource).not.toMatch(/createBrowserClient|localStorage|sessionStorage/);
  });
});
