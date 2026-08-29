"use client";

import { useCallback, useEffect, useState } from "react";

type Operations = {
  windowHours: number;
  summary: { requests: number; failures: number; failureRate: number; averageLatency: number; mentorRequests: number; noticeUploads: number; reviewQueue: number };
  ai: { completed: number; failed: number; inputTokens: number; outputTokens: number };
  plans: Record<string, number>;
  recent: Array<{ route: string; event_type: string; status_code: number; duration_ms: number; created_at: string }>;
};

export function OperationsDashboard() {
  const [data, setData] = useState<Operations | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/operations", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setData(payload); setMessage(""); } else setMessage(payload.error ?? "Painel indisponível.");
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  if (loading) return <div className="surface empty-state">Consolidando operação das últimas 24 horas…</div>;
  if (!data) return <div className="surface empty-state"><b>Acesso não liberado</b><p>{message}</p></div>;
  const metrics = [["Requisições", data.summary.requests], ["Falhas", `${data.summary.failureRate}%`], ["Latência média", `${data.summary.averageLatency} ms`], ["Mentor", data.summary.mentorRequests], ["Uploads", data.summary.noticeUploads], ["Fila de revisão", data.summary.reviewQueue]];
  return <div className="operations"><section className="operations-metrics">{metrics.map(([label, value]) => <article className="surface" key={label}><span>{label}</span><strong>{value}</strong><small>últimas {data.windowHours}h</small></article>)}</section><div className="operations-grid"><section className="surface"><div className="panel-head"><div><h3>IA e consumo</h3><p>Volume auditado no período</p></div></div><div className="operations-facts"><span><small>Concluídas</small><b>{data.ai.completed}</b></span><span><small>Falhas</small><b>{data.ai.failed}</b></span><span><small>Tokens de entrada</small><b>{data.ai.inputTokens}</b></span><span><small>Tokens de saída</small><b>{data.ai.outputTokens}</b></span></div></section><section className="surface"><div className="panel-head"><div><h3>Planos ativos</h3><p>Assinaturas internas ou do gateway futuro</p></div></div><div className="operations-plans">{Object.keys(data.plans).length ? Object.entries(data.plans).map(([plan, count]) => <span key={plan}><b>{plan}</b><strong>{count}</strong></span>) : <div className="empty-state">Nenhuma assinatura explícita; usuários usam os limites do piloto.</div>}</div></section></div><section className="surface operations-log"><div className="panel-head"><div><h3>Eventos recentes</h3><p>Sem conteúdo das perguntas ou documentos</p></div><button className="secondary-button" type="button" onClick={() => void load()}>Atualizar</button></div>{data.recent.length === 0 ? <div className="empty-state">Nenhum evento operacional ainda.</div> : data.recent.map((event, index) => <div className="operations-row" key={`${event.created_at}-${index}`}><span><b>{event.event_type}</b><small>{event.route}</small></span><i className={event.status_code >= 500 ? "bad" : event.status_code >= 400 ? "warn" : "good"}>{event.status_code}</i><strong>{event.duration_ms} ms</strong><time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.created_at))}</time></div>)}</section></div>;
}
