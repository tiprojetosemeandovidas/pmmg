"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { MentorInteraction } from "@/lib/mentor/types";

const suggestions = [
  "O que devo estudar agora?",
  "Quais pontos fracos merecem atenção esta semana?",
  "Como encaixar minhas revisões no plano?",
];

export function MentorChat() {
  const { user, status: authStatus } = useAuth();
  const [interactions, setInteractions] = useState<MentorInteraction[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    const response = await fetch("/api/mentor", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setInteractions(payload.interactions ?? []);
    else setMessage(payload.error ?? "Não foi possível carregar a conversa.");
    setHistoryLoading(false);
  }, [user]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  useEffect(() => { if (interactions.length) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [interactions]);

  async function ask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const current = question.trim();
    if (current.length < 3 || loading) return;
    setQuestion("");
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/mentor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: current }) });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setQuestion(current); setMessage(payload.error ?? "Não foi possível responder."); return; }
    setInteractions((items) => [...items, payload.interaction]);
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask();
    }
  }

  if (authStatus === "loading") return <div className="surface empty-state">Preparando o Mentor…</div>;
  if (!user) return <div className="surface mentor-auth"><div className="mentor-orb">✦</div><div><h2>Seu Mentor precisa conhecer sua rota</h2><p>Entre para usar plano, desempenho, revisões e editais validados como contexto privado.</p></div><Link className="primary-button link-button" href="/entrar?next=/app/mentor">Entrar ou criar conta →</Link></div>;

  return <section className="mentor-shell">
    <div className="mentor-thread">
      {historyLoading ? <div className="surface empty-state">Carregando histórico…</div> : interactions.length === 0 ? <div className="mentor-welcome"><div className="mentor-orb large">✦</div><h2>Como posso orientar sua rota hoje?</h2><p>Eu explico prioridades e proponho ações com base nos seus dados. Não invento desempenho nem garantia de aprovação.</p><div className="mentor-suggestions">{suggestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></div> : interactions.map((interaction) => {
        const sourceMap = new Map(interaction.sources.map((source) => [source.id, source.label]));
        return <div className="mentor-exchange" key={interaction.id}><div className="mentor-user"><span>Você</span><p>{interaction.question}</p></div>{interaction.answer && <article className="mentor-answer"><header><div className="mentor-orb">✦</div><div><b>Mentor Rota</b><small>{interaction.mode === "ai" ? interaction.model : "Motor adaptativo local"} • confiança {interaction.answer.confidence}</small></div></header><p className="mentor-answer-text">{interaction.answer.answer}</p>{interaction.answer.actions.length > 0 && <div className="mentor-actions">{interaction.answer.actions.map((action) => <div key={`${interaction.id}-${action.title}`}><div><b>{action.title}</b><small>{action.reason}</small></div>{action.path && <Link href={action.path as "/app/plano"}>Abrir →</Link>}</div>)}</div>}{interaction.answer.citations.length > 0 && <div className="mentor-sources"><b>Fontes usadas</b>{interaction.answer.citations.map((citation) => <span key={`${interaction.id}-${citation.sourceId}-${citation.claim}`}><i>{citation.sourceId}</i>{sourceMap.get(citation.sourceId) ?? citation.sourceId}<small>{citation.claim}</small></span>)}</div>}{interaction.answer.caveats.length > 0 && <div className="mentor-caveats">{interaction.answer.caveats.map((caveat) => <span key={caveat}>Atenção: {caveat}</span>)}</div>}</article>}</div>;
      })}
      {loading && <div className="mentor-thinking"><div className="mentor-orb">✦</div><span>Analisando sua rota e conferindo as fontes…</span></div>}
      <div ref={endRef} />
    </div>
    <div className="mentor-composer-wrap">{message && <p className="mentor-error" role="status">{message}</p>}<form className="mentor-composer" onSubmit={ask}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKey} maxLength={1200} rows={2} placeholder="Pergunte sobre seu plano, desempenho ou edital…" aria-label="Pergunta para o Mentor" /><button className="primary-button" type="submit" disabled={loading || question.trim().length < 3}>Enviar ↑</button></form><small>O Mentor explica e recomenda; alterações no plano continuam sob seu controle.</small></div>
  </section>;
}
