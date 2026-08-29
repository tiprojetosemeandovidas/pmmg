import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function administrator() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return null;
  const { data } = await session.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", data.user.id).maybeSingle();
  return profile?.account_role === "admin" ? admin : null;
}

export async function GET() {
  const admin = await administrator();
  if (!admin) return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [eventsResult, aiResult, noticeResult, subscriptionsResult, usageResult] = await Promise.all([
    admin.from("operational_events").select("route, event_type, status_code, duration_ms, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
    admin.from("ai_interactions").select("status, latency_ms, input_tokens, output_tokens").gte("created_at", since),
    admin.from("notice_submissions").select("status").in("status", ["needs_ocr", "needs_review"]),
    admin.from("user_subscriptions").select("plan_code, status").in("status", ["trialing", "active", "past_due"]),
    admin.from("usage_events").select("metric, quantity").gte("created_at", since),
  ]);
  if (eventsResult.error) return NextResponse.json({ error: "Execute a migração operacional para abrir este painel." }, { status: 503 });
  const events = eventsResult.data ?? [];
  const ai = aiResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const averageLatency = events.length ? Math.round(events.reduce((sum, item) => sum + item.duration_ms, 0) / events.length) : 0;
  const failures = events.filter((item) => item.status_code >= 500).length;
  const usage = Object.fromEntries(["mentor_request", "notice_upload"].map((metric) => [metric, (usageResult.data ?? []).filter((item) => item.metric === metric).reduce((sum, item) => sum + item.quantity, 0)]));
  const plans = subscriptions.reduce<Record<string, number>>((acc, item) => { acc[item.plan_code] = (acc[item.plan_code] ?? 0) + 1; return acc; }, {});
  return NextResponse.json({
    windowHours: 24,
    summary: { requests: events.length, failures, failureRate: events.length ? Math.round(failures / events.length * 1000) / 10 : 0, averageLatency, mentorRequests: usage.mentor_request ?? 0, noticeUploads: usage.notice_upload ?? 0, reviewQueue: noticeResult.data?.length ?? 0 },
    ai: { completed: ai.filter((item) => item.status === "completed").length, failed: ai.filter((item) => item.status === "failed").length, inputTokens: ai.reduce((sum, item) => sum + (item.input_tokens ?? 0), 0), outputTokens: ai.reduce((sum, item) => sum + (item.output_tokens ?? 0), 0) },
    plans,
    recent: events.slice(0, 30),
  });
}
