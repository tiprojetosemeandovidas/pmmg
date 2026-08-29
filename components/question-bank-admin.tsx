"use client";

import { useCallback, useEffect, useState } from "react";

type Metadata = { id: string; name?: string; title?: string | null; institution?: string; role?: string; exam_year?: number; stable_code?: string; subjects?: { name?: string } | null };
type SourceLink = { relation: string; content_sources: { id: string; title: string; url: string | null; rights_status: string } | null };
type Candidate = { id: string; origin: "manual" | "web_researched"; subject: string; topic: string | null; statement: string; options: string[]; correct_option: number; explanation: string; difficulty: string; status: string; exam_id: string | null; axis_id: string | null; topic_id: string | null; generation_model: string | null; provenance: { sourceSummary?: string }; question_candidate_sources?: SourceLink[] };
type Payload = { candidates: Candidate[]; batches: Array<{ id: string; origin: string; status: string; source_count: number; candidate_count: number; query: string | null; created_at: string }>; exams: Metadata[]; axes: Metadata[]; topics: Metadata[]; perplexityConfigured: boolean };

const emptyManual = { subject: "", topic: "", statement: "", options: ["", "", "", ""], correctOption: 0, explanation: "", difficulty: "medium", sourceTitle: "Cadastro manual", sourceUrl: "", rightsStatus: "unknown", examId: "", axisId: "", topicId: "" };

export function QuestionBankAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"research" | "manual" | "review">("research");
  const [manual, setManual] = useState(emptyManual);
  const [research, setResearch] = useState({ query: "", subject: "", topic: "", count: 5, domains: "gov.br", examId: "", axisId: "", topicId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/question-bank", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setData(payload); setError(""); } else setError(payload.error ?? "Central indisponível.");
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function submit(body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/question-bank", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(payload.error ?? "Não foi possível criar o lote."); return; }
    setMessage(body.action === "research" ? `${payload.candidateCount} questão(ões) e ${payload.sourceCount} fonte(s) enviadas para revisão.` : "Questão manual enviada para revisão.");
    if (body.action === "manual") setManual(emptyManual);
    setTab("review"); await load();
  }

  async function review(candidate: Candidate, status: "approved" | "rejected") {
    const notes = window.prompt(status === "approved" ? "Observação da validação (opcional)" : "Motivo da rejeição") ?? "";
    if (status === "rejected" && !notes.trim()) return;
    setBusy(true); setError("");
    const response = await fetch("/api/admin/question-bank", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: candidate.id, status, notes, examId: candidate.exam_id, axisId: candidate.axis_id, topicId: candidate.topic_id }) });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) setError(payload.error ?? "Não foi possível revisar a questão."); else { setMessage(status === "approved" ? "Questão publicada com proveniência preservada." : "Questão rejeitada."); await load(); }
  }

  if (loading) return <div className="surface empty-state">Carregando banco de questões…</div>;
  if (!data) return <div className="surface empty-state"><b>Acesso não liberado</b><p>{error}</p></div>;
  const pending = data.candidates.filter((item) => item.status === "needs_review");
  const examOptions = data.exams.map((item) => <option key={item.id} value={item.id}>{item.title || `${item.institution} ${item.role} ${item.exam_year}`}</option>);
  const axisOptions = data.axes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>);
  const topicOptions = data.topics.map((item) => <option key={item.id} value={item.id}>{item.subjects?.name ? `${item.subjects.name} — ` : ""}{item.name}</option>);

  return <div className="question-admin">
    <section className="question-admin-stats"><article><span>Pendentes</span><b>{pending.length}</b></article><article><span>Lotes</span><b>{data.batches.length}</b></article><article><span>Origem web</span><b>{data.candidates.filter((item) => item.origin === "web_researched").length}</b></article><article><span>Origem manual</span><b>{data.candidates.filter((item) => item.origin === "manual").length}</b></article></section>
    <div className="question-admin-tabs"><button className={tab === "research" ? "active" : ""} onClick={() => setTab("research")}>Pesquisar com IA</button><button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>Cadastrar manualmente</button><button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>Revisar ({pending.length})</button></div>
    {error && <div className="opportunity-message" role="alert">{error}</div>}{message && <div className="taf-message" role="status">{message}</div>}

    {tab === "research" && <section className="surface question-admin-form"><div className="panel-head"><div><p className="eyebrow">PERPLEXITY • PESQUISA RASTREÁVEL</p><h2>Localizar fontes e criar rascunhos autorais</h2><p>A pesquisa, as URLs e o modelo ficam gravados. Nada é publicado sem revisão.</p></div><span className={data.perplexityConfigured ? "provider-ready" : "provider-missing"}>{data.perplexityConfigured ? "API configurada" : "API não configurada"}</span></div><form onSubmit={(event) => { event.preventDefault(); void submit({ action: "research", ...research, examId: research.examId || null, axisId: research.axisId || null, topicId: research.topicId || null, domains: research.domains.split(/[,\s]+/).filter(Boolean) }); }}><label className="wide">O que a IA deve pesquisar<textarea required minLength={10} maxLength={1200} rows={4} value={research.query} onChange={(event) => setResearch({ ...research, query: event.target.value })} placeholder="Ex.: competências de Ciências da Natureza cobradas no ENEM, usando fontes oficiais do Inep" /></label><label>Disciplina<input required value={research.subject} onChange={(event) => setResearch({ ...research, subject: event.target.value })} /></label><label>Tópico<input value={research.topic} onChange={(event) => setResearch({ ...research, topic: event.target.value })} /></label><label>Quantidade<input type="number" min="1" max="10" value={research.count} onChange={(event) => setResearch({ ...research, count: Number(event.target.value) })} /></label><label>Domínios permitidos<input value={research.domains} onChange={(event) => setResearch({ ...research, domains: event.target.value })} placeholder="gov.br, inep.gov.br" /></label><label>Prova<select value={research.examId} onChange={(event) => setResearch({ ...research, examId: event.target.value })}><option value="">Associar depois</option>{examOptions}</select></label><label>Eixo<select value={research.axisId} onChange={(event) => setResearch({ ...research, axisId: event.target.value })}><option value="">Associar depois</option>{axisOptions}</select></label><label className="wide">Tópico normalizado<select value={research.topicId} onChange={(event) => setResearch({ ...research, topicId: event.target.value })}><option value="">Associar depois</option>{topicOptions}</select></label><button className="primary-button" disabled={busy || !data.perplexityConfigured}>{busy ? "Pesquisando…" : "Pesquisar e criar rascunhos →"}</button></form><small className="curation-note">Use fontes oficiais ou autorizadas. Não pesquise bancos comerciais para reproduzir questões.</small></section>}

    {tab === "manual" && <section className="surface question-admin-form"><div className="panel-head"><div><p className="eyebrow">ORIGEM MANUAL</p><h2>Cadastrar questão com autoria e fonte</h2><p>O registro manual permanece distinguível do conteúdo pesquisado por IA.</p></div></div><form onSubmit={(event) => { event.preventDefault(); void submit({ action: "manual", ...manual, examId: manual.examId || null, axisId: manual.axisId || null, topicId: manual.topicId || null }); }}><label>Disciplina<input required value={manual.subject} onChange={(event) => setManual({ ...manual, subject: event.target.value })} /></label><label>Tópico<input value={manual.topic} onChange={(event) => setManual({ ...manual, topic: event.target.value })} /></label><label className="wide">Enunciado<textarea required minLength={20} rows={4} value={manual.statement} onChange={(event) => setManual({ ...manual, statement: event.target.value })} /></label>{manual.options.map((option, index) => <label key={index}>Alternativa {String.fromCharCode(65 + index)}<input required value={option} onChange={(event) => { const options = [...manual.options]; options[index] = event.target.value; setManual({ ...manual, options }); }} /></label>)}<label>Resposta correta<select value={manual.correctOption} onChange={(event) => setManual({ ...manual, correctOption: Number(event.target.value) })}>{manual.options.map((_, index) => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}</select></label><label>Dificuldade<select value={manual.difficulty} onChange={(event) => setManual({ ...manual, difficulty: event.target.value })}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label><label className="wide">Explicação<textarea required minLength={10} rows={3} value={manual.explanation} onChange={(event) => setManual({ ...manual, explanation: event.target.value })} /></label><label>Título da fonte<input value={manual.sourceTitle} onChange={(event) => setManual({ ...manual, sourceTitle: event.target.value })} /></label><label>URL da fonte<input type="url" value={manual.sourceUrl} onChange={(event) => setManual({ ...manual, sourceUrl: event.target.value })} /></label><label>Direitos<select value={manual.rightsStatus} onChange={(event) => setManual({ ...manual, rightsStatus: event.target.value })}><option value="unknown">Não verificado</option><option value="official">Fonte oficial</option><option value="public_domain">Domínio público</option><option value="authorized">Uso autorizado</option><option value="restricted">Restrito</option></select></label><label>Prova<select value={manual.examId} onChange={(event) => setManual({ ...manual, examId: event.target.value })}><option value="">Associar depois</option>{examOptions}</select></label><label>Eixo<select value={manual.axisId} onChange={(event) => setManual({ ...manual, axisId: event.target.value })}><option value="">Associar depois</option>{axisOptions}</select></label><label>Tópico normalizado<select value={manual.topicId} onChange={(event) => setManual({ ...manual, topicId: event.target.value })}><option value="">Associar depois</option>{topicOptions}</select></label><button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Enviar para revisão →"}</button></form></section>}

    {tab === "review" && <section className="question-review-list">{pending.length ? pending.map((candidate) => <article className="surface question-review-card" key={candidate.id}><header><div><span className={`origin-badge ${candidate.origin}`}>{candidate.origin === "web_researched" ? "IA + pesquisa web" : "Cadastro manual"}</span><h3>{candidate.subject} {candidate.topic ? `• ${candidate.topic}` : ""}</h3><small>{candidate.generation_model ?? "Equipe Rota"} • {candidate.difficulty}</small></div><div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => void review(candidate, "rejected")}>Rejeitar</button><button className="primary-button" disabled={busy} onClick={() => void review(candidate, "approved")}>Validar e publicar</button></div></header><p className="candidate-statement">{candidate.statement}</p><ol type="A">{candidate.options.map((option, index) => <li className={index === candidate.correct_option ? "correct" : ""} key={option}>{option}</li>)}</ol><div className="candidate-explanation"><b>Explicação:</b> {candidate.explanation}</div>{candidate.provenance?.sourceSummary && <p className="source-summary"><b>Fundamento pesquisado:</b> {candidate.provenance.sourceSummary}</p>}<div className="candidate-sources">{candidate.question_candidate_sources?.map((link) => link.content_sources && <a key={link.content_sources.id} href={link.content_sources.url ?? undefined} target="_blank" rel="noreferrer"><span>{link.content_sources.rights_status}</span>{link.content_sources.title}</a>)}</div>{(!candidate.exam_id || !candidate.axis_id) && <div className="opportunity-message">Associe prova e eixo no lote antes de publicar.</div>}</article>) : <div className="surface empty-state">Nenhuma questão aguardando revisão.</div>}</section>}
  </div>;
}
