import type { Metadata } from "next";
import type { Route } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Entrar ou criar conta" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedNext = typeof params.next === "string" ? params.next : "/app";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/app";
  const confirmationError = params.erro === "confirmacao_expirada"
    ? "expired"
    : params.erro === "confirmacao" || params.erro === "confirmacao_invalida"
      ? "invalid"
      : null;
  return <AuthForm initialMode={params.mode === "signup" ? "signup" : "login"} next={next as Route} confirmationError={confirmationError} />;
}
