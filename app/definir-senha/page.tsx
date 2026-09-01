import type { Metadata } from "next";
import { InviteSetupForm } from "@/components/invite-setup-form";
import { safeAuthNext } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Finalizar convite" };

export default async function DefinePasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedNext = typeof params.next === "string" ? params.next : undefined;
  return <InviteSetupForm next={safeAuthNext(requestedNext, "/app?onboarding=1")} />;
}
