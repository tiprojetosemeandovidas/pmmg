"use client";

import { useRota } from "@/components/providers/rota-provider";

export default function PerformancePage() {
  const { state, view } = useRota();
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">SUA EVOLUÇÃO</p><h1>Desempenho</h1><p>Domínio estimado e confiança são exibidos separadamente.</p></div></header><div className="performance-summary"><article><span>Taxa observada</span><strong>{view.accuracy === null ? "Sem dados" : `${view.accuracy}%`}</strong><small>{view.totalAnswers} respostas válidas</small></article><article><span>Rota Score</span><strong>{view.rotaScore}/100</strong><small>Índice de preparação, não probabilidade</small></article><article><span>Revisões pendentes</span><strong>{state.reviewQueue.length}</strong><small>Itens que voltam no momento certo</small></article></div><div className="mastery-table">{view.priorities.map((item) => <article key={item.id}><div><b>{item.subject}</b><small>{item.topic}</small></div><span>Domínio <strong>{Math.round(item.mastery * 100)}%</strong></span><span>Confiança <strong>{Math.round(item.confidence * 100)}%</strong></span><i><b style={{ width: `${Math.round(item.mastery * 100)}%` }} /></i></article>)}</div></div>;
}
