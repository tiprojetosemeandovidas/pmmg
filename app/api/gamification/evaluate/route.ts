import { NextResponse } from "next/server";
import { calculateGamification } from "@/lib/domain/gamification-engine";
import type { RotaState } from "@/lib/domain/rota";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre para sincronizar conquistas." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Gamificação indisponível." }, { status: 503 });
  const [{ data: candidate }, { count: physicalCount }] = await Promise.all([
    admin.from("candidate_states").select("state").eq("user_id", user.id).maybeSingle(),
    admin.from("physical_results").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const state = candidate?.state as RotaState | undefined;
  if (state?.version !== 3) return NextResponse.json({ error: "Conclua o onboarding para liberar missões." }, { status: 409 });
  const snapshot = calculateGamification(state, physicalCount ?? 0);
  const earned = snapshot.achievements.filter((achievement) => achievement.earned);
  if (earned.length) {
    const { error } = await admin.from("user_achievements").upsert(earned.map((achievement) => ({
      user_id: user.id,
      achievement_code: achievement.code,
      evidence: { engineVersion: "healthy-gamification-v1" },
    })), { onConflict: "user_id,achievement_code", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "Não foi possível sincronizar as conquistas." }, { status: 500 });
  }
  return NextResponse.json(snapshot);
}
