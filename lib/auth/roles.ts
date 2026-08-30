export const OWNER_ADMIN_EMAIL = "digitalcarloscruz@gmail.com";

type AuthIdentity = {
  email?: string | null;
  email_confirmed_at?: string | null;
};

export function isOwnerAdministrator(user: AuthIdentity | null | undefined) {
  return Boolean(
    user?.email_confirmed_at
      && user.email?.trim().toLowerCase() === OWNER_ADMIN_EMAIL,
  );
}
