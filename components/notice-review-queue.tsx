"use client";

import { useCallback, useEffect, useState } from "react";
import type { NoticeExtraction } from "@/lib/domain/notice-extractor";
import type { NoticeSubmission } from "@/lib/notices/types";

export function NoticeReviewQueue() {
  const [items, setItems] = useState<Array<NoticeSubmission & { user_id: string }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/notices", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setItems(payload.submissions ?? []); setError(""); }
    else setError(payload.error ?? "Fila indisponível.");
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function review(id: string, status: "validated" | "rejected") {
    const notes = window.prompt(status === "validated" ? "Observação da validação (opcional)" : "Motivo da rejeição") ?? "";
    if (status === "rejected" && !notes.trim()) return;
    const response = await fetch("/api/admin/notices", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, notes }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error ?? "Não foi possível revisar.");
    else await load();
  }

  if (loading) return <div className="surface empty-state">Carregando fila de revisão…</div>;
  if (error) return <div className="surface empty-state"><b>Acesso não liberado</b><p>{error}</p></div>;
  return <div className="review-queue">{items.length === 0 ? <div className="surface empty-state">Fila de revisão vazia.</div> : items.map((item) => { const info = item.structured_data as NoticeExtraction; return <article className="surface review-item" key={item.id}><header><div><p className="eyebrow">{item.status.replaceAll("_", " ")}</p><h2>{item.original_filename}</h2><small>{item.page_count} páginas • confiança {Math.round((item.extraction_confidence ?? 0) * 100)}%</small></div><div className="button-row"><button className="secondary-button" type="button" onClick={() => review(item.id, "rejected")}>Rejeitar</button><button className="primary-button" type="button" onClick={() => review(item.id, "validated")}>Validar</button></div></header><div className="review-data"><span><small>Título provável</small><b>{info.titleCandidate ?? "Não encontrado"}</b></span><span><small>Banca</small><b>{info.boardCandidate ?? "Não encontrada"}</b></span><span><small>Datas</small><b>{info.dates?.join(", ") || "Nenhuma"}</b></span><span><small>Disciplinas</small><b>{info.subjects?.join(", ") || "Nenhuma"}</b></span></div>{info.warnings?.length > 0 && <ul>{info.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</article>; })}</div>;
}
