import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeAuthNext } from "@/lib/auth/redirect";

const emailOtpTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && emailOtpTypes.has(value));
}

function errorRedirect(request: NextRequest, next: string, errorCode?: string | null) {
  const expired = errorCode === "otp_expired" || errorCode === "otp_expired_error";
  const url = new URL("/entrar", request.url);
  url.searchParams.set("erro", expired ? "confirmacao_expirada" : "confirmacao_invalida");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = safeAuthNext(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();

  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return errorRedirect(request, next, error.code);
  }

  if (supabase && tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return errorRedirect(request, next, error.code);
  }

  return errorRedirect(request, next, request.nextUrl.searchParams.get("error_code"));
}
