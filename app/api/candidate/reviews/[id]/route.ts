import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Revisão inválida." }, { status: 422 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Revisões indisponíveis." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para concluir revisões." }, { status: 401 });
  const { data, error } = await admin.rpc("advance_review_item", { p_user_id: auth.user.id, p_review_id: id });
  if (error) return NextResponse.json({ error: error.message.includes("review_not_available") ? "Revisão indisponível." : "Não foi possível concluir a revisão." }, { status: error.message.includes("review_not_available") ? 404 : 500 });
  await admin.from("pilot_events").upsert({ user_id: auth.user.id, event_type: "review_completed", event_key: `review:${id}:${data?.[0]?.interval_step ?? "done"}`, metadata: { intervalStep: data?.[0]?.interval_step ?? null } }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({ data: data?.[0] ?? null });
}
