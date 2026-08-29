"use client";

import Link from "next/link";
import { useRota } from "@/components/providers/rota-provider";

export default function ReviewsPage() {
  const { state } = useRota();
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">REVISÃO INTELIGENTE</p><h1>Caderno de erros</h1><p>Erros voltam de acordo com recência, recorrência e domínio.</p></div><Link className="primary-button link-button" href="/app/questoes">Responder questões</Link></header><div className="review-summary"><article><strong>{state.reviewQueue.length}</strong><span>revisões pendentes</span></article><article><strong>1–7–15–30</strong><span>ciclo inicial, preparado para adaptação</span></article></div><div className="error-list">{state.reviewQueue.length ? state.reviewQueue.map((item) => <article className="error-item" key={item.id}><span>↻</span><div><b>{item.topic} • {item.subject}</b><small>{item.questionText}</small></div><em>{new Intl.DateTimeFormat("pt-BR").format(new Date(item.dueAt))}</em></article>) : <div className="error-empty"><span>✓</span><h3>Seu caderno está limpo</h3><p>Quando você errar uma questão validada, ela aparecerá aqui.</p></div>}</div></div>;
}
