import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOwnerAdministrator } from "@/lib/auth/roles";

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["validated", "rejected"]),
  notes: z.string().trim().max(2000).default(""),
});

async function reviewer() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return null;
  const { data } = await session.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", data.user.id).maybeSingle();
  return profile && ["reviewer", "admin"].includes(profile.account_role) || isOwnerAdministrator(data.user) ? { user: data.user, admin } : null;
}

export async function GET() {
  const access = await reviewer();
  if (!access) return NextResponse.json({ error: "Acesso restrito à equipe de revisão." }, { status: 403 });
  const { data, error } = await access.admin.from("notice_submissions")
    .select("id, user_id, original_filename, file_size, page_count, structured_data, extraction_confidence, status, processing_error, reviewer_notes, created_at, updated_at")
    .in("status", ["needs_ocr", "needs_review", "validated", "rejected"])
    .order("created_at", { ascending: true });
  return error ? NextResponse.json({ error: "Fila indisponível." }, { status: 500 }) : NextResponse.json({ submissions: data });
}

export async function PATCH(request: Request) {
  const access = await reviewer();
  if (!access) return NextResponse.json({ error: "Acesso restrito à equipe de revisão." }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisão inválida." }, { status: 400 });
  const { data: source, error: sourceError } = await access.admin.from("notice_submissions")
    .select("id, exam_id, original_filename, storage_path, file_hash, structured_data, extraction_confidence, validated_notice_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (sourceError || !source) return NextResponse.json({ error: "Submissão não encontrada." }, { status: 404 });

  let validatedNoticeId = source.validated_notice_id as string | null;
  if (parsed.data.status === "validated" && !validatedNoticeId) {
    const { data: notice, error: noticeError } = await access.admin.from("notices").insert({
      exam_id: source.exam_id,
      version_label: source.original_filename,
      storage_path: source.storage_path,
      file_hash: source.file_hash,
      extraction_status: "validated",
      extraction_confidence: source.extraction_confidence,
      structured_data: source.structured_data,
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    }).select("id").single();
    if (noticeError) return NextResponse.json({ error: "O edital não pôde ser publicado na base validada." }, { status: 500 });
    validatedNoticeId = notice.id;
  }
  const { data, error } = await access.admin.from("notice_submissions").update({
    status: parsed.data.status,
    reviewer_notes: parsed.data.notes || null,
    reviewed_by: access.user.id,
    reviewed_at: new Date().toISOString(),
    validated_notice_id: validatedNoticeId,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.id).select("id, status, reviewer_notes, updated_at").single();
  return error ? NextResponse.json({ error: "Não foi possível salvar a revisão." }, { status: 500 }) : NextResponse.json({ submission: data });
}
