import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) redirect("/entrar?next=%2Fapp%2Fadmin");

  const { data: auth } = await session.auth.getUser();
  if (!auth.user) redirect("/entrar?next=%2Fapp%2Fadmin");

  const { data: profile } = await admin
    .from("profiles")
    .select("account_role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile || !["admin", "reviewer"].includes(profile.account_role)) redirect("/app");
  return children;
}
