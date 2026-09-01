import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerAdministrator } from "@/lib/auth/roles";
import { authCallbackUrl } from "@/lib/auth/redirect";

const createSchema = z.object({ action: z.literal("create_cohort"), name: z.string().trim().min(3).max(120), code: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), targetSize: z.number().int().min(1).max(100).default(10) });
const participantSchema = z.object({ action: z.literal("add_participant"), cohortId: z.string().uuid(), email: z.string().trim().email().max(320) });
const inviteSchema = z.object({ action: z.literal("send_invite"), participantId: z.string().uuid() });
const linkSchema = z.object({ action: z.literal("generate_invite_link"), participantId: z.string().uuid() });
const statusSchema = z.object({ participantId: z.string().uuid(), status: z.enum(["completed", "withdrawn"]) });

function pilotRedirectUrl(request: Request, cohortCode: string) {
  const pilotNext = `/app?onboarding=1&pilot=${cohortCode}`;
  const setupNext = `/definir-senha?next=${encodeURIComponent(pilotNext)}`;
  return authCallbackUrl(new URL(request.url).origin, setupNext);
}

async function sendPilotInvite(request: Request, email: string, cohortCode: string) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "Serviço de envio não configurado." };
  const redirectTo = pilotRedirectUrl(request, cohortCode);
  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { pilot_cohort_code: cohortCode },
  });
  if (!invited.error) return { ok: true as const, delivery: "invite" as const };

  const magicLink = await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (!magicLink.error) return { ok: true as const, delivery: "magic_link" as const };
  return { ok: false as const, error: magicLink.error.message || invited.error.message };
}

async function administrator() {
  const session = await createClient();
  if (!session) return null;
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await session.from("profiles").select("account_role").eq("id", auth.user.id).maybeSingle();
  return profile?.account_role === "admin" || isOwnerAdministrator(auth.user) ? { admin: session, user: auth.user } : null;
}

export async function GET() {
  const access = await administrator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const [{ data: cohorts, error }, { data: participants }, { data: feedback }, { data: events }] = await Promise.all([
    access.admin.from("pilot_cohorts").select("id,code,name,target_size,status,starts_at,ends_at,created_at").order("created_at", { ascending: false }),
    access.admin.from("pilot_participants").select("id,cohort_id,user_id,invite_email,status,consented_at,joined_at,completed_at,created_at").order("created_at"),
    access.admin.from("pilot_feedback").select("cohort_id,user_id,stage,ease_score,value_score,recommendation_score,comment,created_at").order("created_at", { ascending: false }),
    access.admin.from("pilot_events").select("user_id,event_type,created_at").order("created_at", { ascending: false }).limit(2000),
  ]);
  if (error) return NextResponse.json({ error: "Execute a migration da coorte do piloto." }, { status: 503 });
  return NextResponse.json({ cohorts: (cohorts ?? []).map((cohort) => ({ ...cohort,
    participants: (participants ?? []).filter((item) => item.cohort_id === cohort.id).map((participant) => ({ ...participant,
      eventTypes: [...new Set((events ?? []).filter((event) => event.user_id === participant.user_id).map((event) => event.event_type))],
      feedback: (feedback ?? []).filter((item) => item.cohort_id === cohort.id && item.user_id === participant.user_id),
    })),
  })) });
}

export async function POST(request: Request) {
  const access = await administrator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const created = createSchema.safeParse(body);
  if (created.success) {
    const { data, error } = await access.admin.from("pilot_cohorts").insert({ name: created.data.name, code: created.data.code, target_size: created.data.targetSize, status: "recruiting", created_by: access.user.id }).select("id,code,name,target_size,status").single();
    if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Já existe uma coorte com esse código." : error?.code === "42501" ? "A política administrativa do piloto ainda não foi aplicada." : `Não foi possível criar a coorte${error?.code ? ` (${error.code})` : ""}.` }, { status: error?.code === "23505" ? 409 : error?.code === "42501" ? 403 : 500 });
    return NextResponse.json({ data }, { status: 201 });
  }
  const invite = inviteSchema.safeParse(body);
  if (invite.success) {
    const { data: invitedParticipant } = await access.admin
      .from("pilot_participants")
      .select("id,invite_email,status,pilot_cohorts!inner(code,status)")
      .eq("id", invite.data.participantId)
      .eq("status", "invited")
      .maybeSingle();
    const cohort = Array.isArray(invitedParticipant?.pilot_cohorts) ? invitedParticipant.pilot_cohorts[0] : invitedParticipant?.pilot_cohorts;
    if (!invitedParticipant || !cohort || !["recruiting", "active"].includes(cohort.status)) return NextResponse.json({ error: "Convite indisponível para reenvio." }, { status: 409 });
    const delivery = await sendPilotInvite(request, invitedParticipant.invite_email, cohort.code);
    if (!delivery.ok) return NextResponse.json({ error: `O provedor não enviou o convite: ${delivery.error}` }, { status: 502 });
    return NextResponse.json({ data: { id: invitedParticipant.id, invite_email: invitedParticipant.invite_email, status: invitedParticipant.status, delivery: delivery.delivery } });
  }
  const generatedLink = linkSchema.safeParse(body);
  if (generatedLink.success) {
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Serviço de autenticação não configurado." }, { status: 503 });
    const { data: invitedParticipant } = await access.admin
      .from("pilot_participants")
      .select("id,invite_email,status,pilot_cohorts!inner(code,status)")
      .eq("id", generatedLink.data.participantId)
      .eq("status", "invited")
      .maybeSingle();
    const cohort = Array.isArray(invitedParticipant?.pilot_cohorts) ? invitedParticipant.pilot_cohorts[0] : invitedParticipant?.pilot_cohorts;
    if (!invitedParticipant || !cohort || !["recruiting", "active"].includes(cohort.status)) return NextResponse.json({ error: "Link indisponível para este participante." }, { status: 409 });
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: invitedParticipant.invite_email,
      options: { redirectTo: pilotRedirectUrl(request, cohort.code) },
    });
    if (error || !data.properties?.action_link) return NextResponse.json({ error: "Não foi possível gerar o link único." }, { status: 502 });
    return NextResponse.json({ data: { actionLink: data.properties.action_link } });
  }
  const participant = participantSchema.safeParse(body);
  if (!participant.success) return NextResponse.json({ error: "Dados do participante inválidos." }, { status: 422 });
  const { data: cohort } = await access.admin.from("pilot_cohorts").select("id,code,target_size,status").eq("id", participant.data.cohortId).in("status", ["recruiting", "active"]).maybeSingle();
  if (!cohort) return NextResponse.json({ error: "Coorte indisponível para convites." }, { status: 409 });
  const { count } = await access.admin.from("pilot_participants").select("id", { count: "exact", head: true }).eq("cohort_id", cohort.id).neq("status", "withdrawn");
  if ((count ?? 0) >= cohort.target_size) return NextResponse.json({ error: "A coorte já atingiu o limite de participantes." }, { status: 409 });
  const { data, error } = await access.admin.from("pilot_participants").insert({ cohort_id: cohort.id, invite_email: participant.data.email.toLowerCase(), created_by: access.user.id }).select("id,invite_email,status").single();
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "Este e-mail já está na coorte." : "Não foi possível incluir o participante." }, { status: error?.code === "23505" ? 409 : 500 });
  const delivery = await sendPilotInvite(request, data.invite_email, cohort.code);
  if (!delivery.ok) {
    await access.admin.from("pilot_participants").delete().eq("id", data.id);
    return NextResponse.json({ error: `Participante não incluído porque o provedor não enviou o convite: ${delivery.error}` }, { status: 502 });
  }
  return NextResponse.json({ data: { ...data, delivery: delivery.delivery } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await administrator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à administração." }, { status: 403 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Atualização inválida." }, { status: 422 });
  const now = new Date().toISOString();
  const { data, error } = await access.admin.from("pilot_participants").update({ status: parsed.data.status, completed_at: parsed.data.status === "completed" ? now : null, updated_at: now }).eq("id", parsed.data.participantId).select("id,status,completed_at").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar o participante." }, { status: 500 });
  return NextResponse.json({ data });
}
