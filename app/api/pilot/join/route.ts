import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), consent: z.literal(true) });

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Piloto indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user?.email) return NextResponse.json({ error: "Entre com o e-mail convidado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirme sua participação voluntária." }, { status: 422 });
  const { data: cohort } = await admin.from("pilot_cohorts").select("id,name,status").eq("code", parsed.data.code).in("status", ["recruiting", "active"]).maybeSingle();
  if (!cohort) return NextResponse.json({ error: "Convite indisponível." }, { status: 404 });
  const email = auth.user.email.trim().toLowerCase();
  const { data: participant } = await admin.from("pilot_participants").select("id,status,user_id").eq("cohort_id", cohort.id).eq("invite_email", email).maybeSingle();
  if (!participant) return NextResponse.json({ error: "Este e-mail não está na lista da coorte." }, { status: 403 });
  if (participant.user_id && participant.user_id !== auth.user.id) return NextResponse.json({ error: "O convite já foi utilizado." }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await admin.from("pilot_participants").update({ user_id: auth.user.id, status: "active", consented_at: now, joined_at: now, updated_at: now }).eq("id", participant.id);
  if (error) return NextResponse.json({ error: "Não foi possível confirmar sua participação." }, { status: 500 });
  await admin.from("pilot_events").upsert({ user_id: auth.user.id, event_type: "pilot_joined", event_key: `pilot-joined:${cohort.id}`, metadata: { cohortCode: parsed.data.code } }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({ data: { cohort: cohort.name, status: "active" } });
}
