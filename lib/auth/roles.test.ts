import { describe, expect, it } from "vitest";
import { isOwnerAdministrator } from "@/lib/auth/roles";

describe("isOwnerAdministrator", () => {
  it("recognizes the confirmed owner account", () => {
    expect(isOwnerAdministrator({ email: "DigitalCarlosCruz@gmail.com", email_confirmed_at: "2026-08-30T00:00:00Z" })).toBe(true);
  });

  it("rejects unconfirmed or different accounts", () => {
    expect(isOwnerAdministrator({ email: "digitalcarloscruz@gmail.com", email_confirmed_at: null })).toBe(false);
    expect(isOwnerAdministrator({ email: "outro@gmail.com", email_confirmed_at: "2026-08-30T00:00:00Z" })).toBe(false);
  });
});
