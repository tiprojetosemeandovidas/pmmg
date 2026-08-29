"use client";

import { useRota } from "@/components/providers/rota-provider";

export default function RadarPage() {
  const { state, view } = useRota();
  const values = view.priorities.map((item) => state.mastery[item.id] ?? { score: .5, confidence: 0 });
  const coverage = Math.round((values.filter((item) => item.confidence >= 0.2).length / values.length) * 100);
  const mastery = Math.round((values.reduce((sum, item) => sum + item.score, 0) / values.length) * 100);
  const consistency = state.plan.length ? Math.min(100, Math.round((state.stats.completedSessions / state.plan.length) * 100)) : 0;
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">ROTA SCORE</p><h1>Sua prontidão, sem achismo.</h1><p>Domínio, cobertura de evidências e consistência — sempre com explicação.</p></div></header><div className="radar-layout"><section className="radar-score"><div className="big-score"><strong>{view.rotaScore}</strong><small>/100</small></div><h2>Índice de preparação</h2><p>Maior prioridade: <b>{view.priorities[0].subject}</b></p></section><section className="radar-metrics">{[["Cobertura com evidência",coverage],["Domínio médio",mastery],["Consistência semanal",consistency]].map(([label,value]) => <article key={String(label)}><span>{label}</span><strong>{value}%</strong><i><b style={{ width: `${value}%` }} /></i></article>)}</section></div><section className="syllabus-map"><div className="panel-head"><div><h3>Mapa de conhecimento</h3><p>O domínio é reaproveitável entre concursos</p></div></div><div className="topic-map">{view.priorities.map((item) => <article className={item.mastery >= 0.7 ? "map-good" : item.mastery >= 0.5 ? "map-warn" : "map-bad"} key={item.id}><b>{item.subject}</b><span>{item.topic} • confiança {Math.round(item.confidence * 100)}%</span><strong>{Math.round(item.mastery * 100)}%</strong></article>)}</div></section></div>;
}
