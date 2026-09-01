import { describe, expect, it } from "vitest";
import { authCallbackUrl, safeAuthNext } from "@/lib/auth/redirect";

describe("auth redirect", () => {
  it("preserves the onboarding query as one callback parameter", () => {
    const callback = new URL(authCallbackUrl("https://rota-pmmg.vercel.app"));
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/app?onboarding=1");
  });

  it("preserves the pilot code through email confirmation", () => {
    const next = "/app?onboarding=1&pilot=enem-piloto-1";
    const callback = new URL(authCallbackUrl("https://pmmg-ti-semeando-vidas.vercel.app", next));
    expect(callback.searchParams.get("next")).toBe(next);
  });

  it("allows an internal password-setup route with a nested pilot destination", () => {
    const pilotNext = "/app?onboarding=1&pilot=enem-piloto-1";
    const setupNext = `/definir-senha?next=${encodeURIComponent(pilotNext)}`;
    const callback = new URL(authCallbackUrl("https://pmmg-livid.vercel.app", setupNext));
    expect(callback.searchParams.get("next")).toBe(setupNext);
    expect(safeAuthNext(setupNext)).toBe(setupNext);
  });

  it("rejects external and backslash redirects", () => {
    expect(safeAuthNext("//evil.example")).toBe("/app");
    expect(safeAuthNext("/\\evil.example")).toBe("/app");
    expect(safeAuthNext("https://evil.example")).toBe("/app");
  });
});
