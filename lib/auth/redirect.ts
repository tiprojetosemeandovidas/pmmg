export const DEFAULT_AUTH_NEXT = "/app?onboarding=1";

export function safeAuthNext(value: string | null | undefined, fallback = "/app") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export function authCallbackUrl(origin: string, next = DEFAULT_AUTH_NEXT) {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeAuthNext(next));
  return callback.toString();
}
