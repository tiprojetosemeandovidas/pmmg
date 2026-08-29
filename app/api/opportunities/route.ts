import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateOpportunityMatches } from "@/lib/domain/opportunity-engine";
import type { RotaState } from "@/lib/domain/rota";
import { CAREER_TRACKS } from "@/lib/opportunities/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const commandSchema = z.object({
  trackCode: z.string().trim().min(2).max(80),
  status: z.enum(["watching", "secondary", "removed"]),
});

async function currentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ tracks: CAREER_TRACKS, tracked: [], persistence: "local" });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ tracks: CAREER_TRACKS, tracked: [], persistence: "unavailable" });
  const { data, error } = await admin.from("user_career_tracks")
    .select("track_code, status, compatibility_score, updated_at")
    .eq("user_id", user.id);
  return NextResponse.json({
    tracks: CAREER_TRACKS,
    tracked: error ? [] : (data ?? []).map((item) => ({
      trackCode: item.track_code,
      status: item.status,
      compatibilityScore: item.compatibility_score,
      updatedAt: item.updated_at,
    })),
    persistence: error ? "migration_required" : "database",
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre para acompanhar oportunidades." }, { status: 401 });
  const command = commandSchema.safeParse(await request.json().catch(() => null));
  if (!command.success || !CAREER_TRACKS.some((track) => track.code === command.data.trackCode)) {
    return NextResponse.json({ error: "Trilha inválida." }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Persistência indisponível." }, { status: 503 });
  if (command.data.status === "removed") {
    const { error } = await admin.from("user_career_tracks").delete().eq("user_id", user.id).eq("track_code", command.data.trackCode);
    if (error) return NextResponse.json({ error: "Não foi possível remover a trilha." }, { status: 500 });
    return NextResponse.json({ tracked: false });
  }
  const { data: snapshot } = await admin.from("candidate_states").select("state").eq("user_id", user.id).maybeSingle();
  const state = snapshot?.state as RotaState | undefined;
  if (state?.version !== 3) return NextResponse.json({ error: "Conclua o onboarding antes de acompanhar uma trilha." }, { status: 409 });
  const match = calculateOpportunityMatches(state).find((item) => item.track.code === command.data.trackCode);
  if (!match) return NextResponse.json({ error: "Trilha não encontrada." }, { status: 404 });
  const now = new Date().toISOString();
  const { error } = await admin.from("user_career_tracks").upsert({
    user_id: user.id,
    track_code: command.data.trackCode,
    status: command.data.status,
    compatibility_score: match.compatibility,
    calculation_snapshot: {
      readiness: match.readiness,
      confidence: match.confidence,
      rankingScore: match.rankingScore,
      eligibility: match.eligibility,
      engineVersion: "compatibility-v1",
    },
    updated_at: now,
  });
  if (error) return NextResponse.json({ error: "Não foi possível acompanhar a trilha." }, { status: 500 });
  return NextResponse.json({ tracked: true, trackCode: command.data.trackCode, status: command.data.status, updatedAt: now });
}
