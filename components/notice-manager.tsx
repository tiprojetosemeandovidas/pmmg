"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { NoticeExtraction } from "@/lib/domain/notice-extractor";
import type { NoticeStatus, NoticeSubmission } from "@/lib/notices/types";

const STATUS: Record<NoticeStatus, { label: string; detail: string }> = {
  uploaded: { label: "Recebido", detail: "Aguardando processamento." },
  extracting: { label: "Extraindo", detail: "Lendo a camada textual do PDF." },
  needs_ocr: { label: "Requer OCR", detail: "O arquivo parece digitalizado e seguirá para leitura assistida." },
  needs_review: { label: "Em revisão", detail: "A extração terminou e aguarda validação humana." },
  validated: { label: "Validado", detail: "Dados aprovados para alimentar seu plano." },
  rejected: { label: "Rejeitado", detail: "O arquivo não pôde ser usado. Consulte a observação." },
  failed: { label: "Falha", detail: "O processamento não foi concluído." },
};

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function NoticeManager() {
  const { user, status: authStatus } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] = useState<NoticeSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const response = await fetch("/api/notices", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setSubmissions(payload.submissions ?? []);
    else setMessage(payload.error ?? "Não foi possível carregar seus editais.");
    setLoading(false);
  }, [user]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return setMessage("Selecione um edital em PDF.");
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/notices", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok) return setMessage(payload.error ?? "Não foi possível enviar o edital.");
    setMessage(payload.duplicate ? "Este mesmo arquivo já estava na sua fila." : "Edital recebido e analisado com segurança.");
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  if (authStatus === "loading") return <div className="surface empty-state">Verificando sua sessão…</div>;
  if (!user) return <div className="surface notice-auth"><span className="subject-icon">◇</span><div><h2>Entre para analisar seu edital</h2><p>O PDF é privado e cada envio fica isolado na sua conta.</p></div><Link className="primary-button link-button" href="/entrar?next=/app/editais">Entrar ou criar conta →</Link></div>;

  return (
    <div className="notice-engine">
      <form className="surface notice-upload" onSubmit={upload}>
        <div><p className="eyebrow">EDITAL ENGINE</p><h2>Envie o edital oficial</h2><p>PDF de até 15 MB e 400 páginas. A extração automática nunca é publicada sem revisão humana.</p></div>
        <label className="file-drop"><input ref={inputRef} type="file" name="file" accept="application/pdf,.pdf" required /><span>Selecionar PDF</span><small>Arquivo privado • leitura segura</small></label>
        <button className="primary-button" type="submit" disabled={uploading}>{uploading ? "Lendo o edital…" : "Analisar edital →"}</button>
      </form>
      {message && <p className="notice-message" role="status">{message}</p>}
      <section className="notice-history">
        <div className="panel-head"><div><h3>Seus editais</h3><p>Acompanhe extração, OCR e validação.</p></div><b>{submissions.length}</b></div>
        {loading ? <div className="surface empty-state">Carregando editais…</div> : submissions.length === 0 ? <div className="surface empty-state">Nenhum edital enviado ainda.</div> : submissions.map((item) => {
          const extraction = item.structured_data as NoticeExtraction;
          const status = STATUS[item.status];
          return <article className="surface notice-submission" key={item.id}>
            <div className="notice-file-icon">PDF</div>
            <div className="notice-submission-body"><div className="notice-submission-title"><div><h3>{item.original_filename}</h3><p>{size(item.file_size)} • {item.page_count ?? "—"} páginas • enviado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><span className={`notice-status ${item.status}`}>{status.label}</span></div>
              <p>{item.reviewer_notes || item.processing_error || status.detail}</p>
              {extraction?.textCharacters !== undefined && <div className="extraction-grid"><span><small>Confiança</small><b>{Math.round((item.extraction_confidence ?? 0) * 100)}%</b></span><span><small>Banca provável</small><b>{extraction.boardCandidate ?? "Revisar"}</b></span><span><small>Disciplinas encontradas</small><b>{extraction.subjects?.length ?? 0}</b></span><span><small>Sinais</small><b>{[extraction.signals?.hasTaf && "TAF", extraction.signals?.hasEssay && "Discursiva"].filter(Boolean).join(" + ") || "Nenhum"}</b></span></div>}
            </div>
          </article>;
        })}
      </section>
    </div>
  );
}
