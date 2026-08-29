"use client";

import { useRota } from "@/components/providers/rota-provider";

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function PlanPage() {
  const { state, view, recalculate } = useRota();
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">PLANEJAMENTO ADAPTATIVO</p><h1>Meu plano de estudos</h1><p>Organizado conforme objetivo, domínio, recência e tempo disponível.</p></div><button className="outline-button" type="button" onClick={() => recalculate()}>↻ Recalcular minha rota</button></header><div className="plan-summary"><div><span>MODO ATUAL</span><b>{view.modeLabel}</b></div><div><span>CARGA SEMANAL</span><b>{state.profile.weeklyHours} horas</b></div><div><span>EVIDÊNCIAS</span><b>{view.totalAnswers} respostas</b></div></div><div className="calendar-card">{state.plan.map((task) => { const date = new Date(task.scheduledFor); return <article className={`cal-day ${task.status === "completed" ? "complete" : ""}`} key={task.id}><b>{days[date.getDay()]}, {String(date.getDate()).padStart(2, "0")}</b><i>{task.subject}</i><small>{task.topic}</small><span>{task.minutes} min • prioridade {task.priority}</span></article>; })}</div></div>;
}
