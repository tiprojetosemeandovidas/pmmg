"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRota } from "@/components/providers/rota-provider";

type PersistedReview = { id: string; questionId: string; intervalStep: number; dueAt: string; statement: string; subject: string; topic: string; options: string[]; due: boolean };

export default function ReviewsPage() {
  const { state } = useRota();
  const [remote, setRemote] = useState<PersistedReview[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { correct: boolean; explanation: string | null }>>({});

  useEffect(() => {
    fetch("/api/candidate/reviews").then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { data?: PersistedReview[] }) => setRemote(payload.data ?? []))
      .catch(() => setRemote(null));
  }, []);

  async function answerReview(item: PersistedReview, selectedOption: number) {
    setBusyId(item.id);
    const response = await fetch("/api/candidate/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: item.questionId, selectedOption, idempotencyKey: crypto.randomUUID(), reviewId: item.id }) });
    const payload = await response.json().catch(() => ({})) as { data?: { correct: boolean; explanation: string | null } };
    if (response.ok && payload.data) {
      setFeedback((current) => ({ ...current, [item.id]: payload.data! }));
      if (payload.data.correct) {
        const advanced = await fetch(`/api/candidate/reviews/${item.id}`, { method: "POST" });
        if (advanced.ok) setRemote((current) => current?.filter((review) => review.id !== item.id) ?? []);
      }
    }
    setBusyId(null);
  }

  const local = state.reviewQueue.map((item) => ({ id: item.id, questionId: "", intervalStep: item.recurrenceCount + 1, dueAt: item.dueAt, statement: item.questionText, subject: item.subject, topic: item.topic, options: [], due: new Date(item.dueAt) <= new Date() }));
  const reviews = remote === null
    ? local
    : [...remote, ...local.filter((item) => !remote.some((persisted) => persisted.statement === item.statement))];
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">REVISÃO INTELIGENTE</p><h1>Caderno de erros</h1><p>Erros voltam de acordo com recência, recorrência e domínio.</p></div><Link className="primary-button link-button" href="/app/questoes">Responder questões</Link></header><div className="review-summary"><article><strong>{reviews.length}</strong><span>revisões pendentes</span></article><article><strong>1–7–15–30</strong><span>ciclo de repetição espaçada</span></article></div><div className="error-list">{reviews.length ? reviews.map((item) => <article className="error-item" key={item.id}><span>↻</span><div><b>{item.topic} • {item.subject}</b><small>{item.statement}</small>{remote && item.due && item.options.length > 0 && <div className="review-options">{item.options.map((option, index) => <button className="outline-button" disabled={busyId === item.id || feedback[item.id]?.correct} type="button" key={`${item.id}-${index}`} onClick={() => void answerReview(item, index)}><i>{String.fromCharCode(65 + index)}</i>{option}</button>)}</div>}{feedback[item.id] && <small className={feedback[item.id].correct ? "review-correct" : "review-wrong"}>{feedback[item.id].correct ? "Resposta correta; próxima revisão agendada." : "Resposta incorreta; revise a explicação e tente novamente."} {feedback[item.id].explanation}</small>}</div><em>{item.due ? "Disponível agora" : new Intl.DateTimeFormat("pt-BR").format(new Date(item.dueAt))}</em>{remote && !item.due && <button className="outline-button" disabled type="button">Aguardando ciclo</button>}</article>) : <div className="error-empty"><span>✓</span><h3>Seu caderno está limpo</h3><p>Quando você errar uma questão validada, ela aparecerá aqui.</p></div>}</div></div>;
}
