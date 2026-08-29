import { describe, expect, it } from "vitest";
import { authCallbackUrl, safeAuthNext } from "@/lib/auth/redirect";

describe("auth redirect", () => {
  it("preserves the onboarding query as one callback parameter", () => {
    const callback = new URL(authCallbackUrl("https://rota-pmmg.vercel.app"));
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/app?onboarding=1");
  });

  it("rejects external and backslash redirects", () => {
    expect(safeAuthNext("//evil.example")).toBe("/app");
    expect(safeAuthNext("/\\evil.example")).toBe("/app");
    expect(safeAuthNext("https://evil.example")).toBe("/app");
  });
});
