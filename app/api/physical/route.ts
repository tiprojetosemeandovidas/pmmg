import { NextResponse } from "next/server";
import { z } from "zod";
import { PHYSICAL_EVENTS } from "@/lib/progress/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_goal"), eventCode: z.string(), targetValue: z.number().positive().max(100_000) }),
  z.object({ action: z.literal("remove_goal"), eventCode: z.string() }),
  z.object({ action: z.literal("record_result"), eventCode: z.string(), value: z.number().positive().max(100_000), measuredAt: z.iso.date(), notes: z.string().trim().max(300).optional() }),
]);
const maximumValues: Record<string, number> = { run_12m: 10_000, pull_ups: 200, push_ups: 500, sit_ups: 500, shuttle_run: 120 };

async function currentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ events: PHYSICAL_EVENTS, goals: [], results: [], persistence: "local" });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Acompanhamento físico indisponível." }, { status: 503 });
  const [{ data: goals, error: goalError }, { data: results, error: resultError }] = await Promise.all([
    admin.from("physical_goals").select("event_code, target_value, goal_source, is_official, updated_at").eq("user_id", user.id),
    admin.from("physical_results").select("id, event_code, value, measured_at, notes").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(100),
  ]);
  if (goalError || resultError) return NextResponse.json({ error: "Não foi possível carregar o acompanhamento físico." }, { status: 500 });
  return NextResponse.json({
    events: PHYSICAL_EVENTS,
    goals: (goals ?? []).map((item) => ({ eventCode: item.event_code, targetValue: Number(item.target_value), goalSource: item.goal_source, isOfficial: item.is_official, updatedAt: item.updated_at })),
    results: (results ?? []).map((item) => ({ id: item.id, eventCode: item.event_code, value: Number(item.value), measuredAt: item.measured_at, notes: item.notes })),
    persistence: "database",
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre para registrar sua preparação física." }, { status: 401 });
  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success || !PHYSICAL_EVENTS.some((event) => event.code === payload.data.eventCode)) {
    return NextResponse.json({ error: "Medição inválida." }, { status: 400 });
  }
  if (payload.data.action !== "remove_goal") {
    const value = payload.data.action === "set_goal" ? payload.data.targetValue : payload.data.value;
    if (value > maximumValues[payload.data.eventCode]) return NextResponse.json({ error: "Valor fora da faixa esperada para este exercício." }, { status: 400 });
  }
  if (payload.data.action === "record_result" && (payload.data.measuredAt < "2000-01-01" || payload.data.measuredAt > new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Data da medição inválida." }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Acompanhamento físico indisponível." }, { status: 503 });
  if (payload.data.action === "remove_goal") {
    const { error } = await admin.from("physical_goals").delete().eq("user_id", user.id).eq("event_code", payload.data.eventCode);
    if (error) return NextResponse.json({ error: "Não foi possível remover a meta." }, { status: 500 });
    return NextResponse.json({ removed: true });
  }
  if (payload.data.action === "set_goal") {
    const now = new Date().toISOString();
    const { error } = await admin.from("physical_goals").upsert({ user_id: user.id, event_code: payload.data.eventCode, target_value: payload.data.targetValue, goal_source: "personal", is_official: false, updated_at: now });
    if (error) return NextResponse.json({ error: "Não foi possível salvar a meta." }, { status: 500 });
    return NextResponse.json({ saved: true, updatedAt: now });
  }
  const { data, error } = await admin.from("physical_results").insert({ user_id: user.id, event_code: payload.data.eventCode, value: payload.data.value, measured_at: payload.data.measuredAt, notes: payload.data.notes || null }).select("id").single();
  if (error) return NextResponse.json({ error: "Não foi possível registrar a medição." }, { status: 500 });
  return NextResponse.json({ saved: true, id: data.id });
}
