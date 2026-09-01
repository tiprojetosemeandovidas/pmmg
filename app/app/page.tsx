"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OnboardingModal } from "@/components/onboarding-modal";
import { GamificationPanel } from "@/components/gamification-panel";
import { useRota } from "@/components/providers/rota-provider";
import { PilotEnrollment } from "@/components/pilot-enrollment";
import { enemFocusLabel } from "@/lib/domain/onboarding";

const dayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, view, hydrated, completeWeeklyCheckin } = useRota();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinPace, setCheckinPace] = useState<"light" | "balanced" | "heavy">("balanced");
  const [checkinHours, setCheckinHours] = useState(state.profile.weeklyHours);
  const pilotCode = searchParams.get("pilot");
  const [pilotAccepted, setPilotAccepted] = useState(() => !pilotCode);
  const [pageOpenedAt] = useState(() => Date.now());
  const nextPriority = view.priorities.find((item) => item.id === view.nextAction.topicId) ?? view.priorities[0];
  const shouldShowOnboarding = pilotAccepted && (onboardingOpen || (!onboardingDismissed && hydrated && (!state.profile.onboardingCompleted || searchParams.get("onboarding") === "1")));
  const minutes = state.stats.completedMinutes;
  const isEnem = state.profile.career === "enem-2026";
  const enemDays = Math.max(0, Math.ceil((new Date("2026-11-08T12:00:00-03:00").getTime() - pageOpenedAt) / 86_400_000));

  function startNextAction() {
    if (view.nextAction.type === "weekly_checkin") {
      setCheckinHours(state.profile.weeklyHours);
      setCheckinOpen(true);
      window.setTimeout(() => document.getElementById("weekly-checkin")?.scrollIntoView({ behavior: "smooth" }), 0);
      return;
    }
    if (view.nextAction.type === "review") return router.push("/app/revisoes");
    if (view.nextAction.type === "simulation") return router.push("/app/simulados");
    router.push("/app/questoes");
  }

  function finishCheckin() {
    completeWeeklyCheckin({ pace: checkinPace, nextWeeklyHours: checkinHours });
    setCheckinOpen(false);
  }

  return (
    <div className="next-content">
      <PilotEnrollment code={pilotCode} onJoined={() => setPilotAccepted(true)} />
      <section className="welcome-row">
        <div><p className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}</p><h1>Olá, {state.profile.name} <span>👋</span></h1><p className="subtitle">{view.modeLabel} • {state.profile.careerLabel}</p></div>
        <button className="outline-button" type="button" onClick={() => setOnboardingOpen(true)}>⚙ Ajustar minha rota</button>
      </section>

      {isEnem && <section className="enem-countdown"><div><span>ENEM 2026 • CALENDÁRIO OFICIAL</span><h2>{enemDays} dias para o primeiro dia</h2><p>8 de novembro: Linguagens, Ciências Humanas e Redação • 15 de novembro: Ciências da Natureza e Matemática.</p><p><b>Meta atual:</b> {state.profile.targetCourse || enemFocusLabel(state.profile.enemFocusArea)}{state.profile.targetInstitution ? ` • ${state.profile.targetInstitution}` : ""}</p></div><div><b>8</b><small>NOV</small><i /><b>15</b><small>NOV</small></div><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/orientacoes/cronograma" target="_blank" rel="noreferrer">Ver cronograma do Inep ↗</a></section>}

      <section className="focus-card">
        <div className="focus-copy"><div className="label"><span className="pulse" /> PRÓXIMA MELHOR AÇÃO</div><div className="focus-title"><span className="subject-icon">{nextPriority.icon}</span><div><small>{view.nextAction.subject.toUpperCase()}</small><h2>{view.nextAction.topic}</h2></div></div><p>{view.nextAction.explanation}</p><div className="session-meta"><span>◷ <b>{view.nextAction.minutes} min</b></span><span>▣ {view.nextAction.type === "weekly_checkin" ? "Fechamento semanal" : "Estudo direcionado"}</span><span>↗ Prioridade <b>{view.nextAction.priority}/100</b></span></div><button className="primary-button" type="button" onClick={startNextAction}>{view.nextAction.type === "weekly_checkin" ? "Fazer fechamento" : "Iniciar sessão"} <span>→</span></button></div>
        <div className="focus-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="target-rings"><i /><i /><i /><b>{Math.round(nextPriority.mastery * 100)}<small>%</small></b></div><span className="target-caption">Domínio estimado</span></div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card"><div className="metric-icon green">✓</div><div><span>Sessões concluídas</span><strong>{state.stats.completedSessions} <small>/ {state.stats.plannedSessions}</small></strong><p>Atualizado pela sua rota</p></div></article>
        <article className="metric-card"><div className="metric-icon amber">◎</div><div><span>Tempo de estudo</span><strong>{minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min`}</strong><p>Meta: {state.profile.weeklyHours}h semanais</p></div></article>
        <article className="metric-card"><div className="metric-icon blue">↗</div><div><span>Taxa observada</span><strong>{view.accuracy === null ? "Sem dados" : `${view.accuracy}%`}</strong><p>{view.totalAnswers} respostas válidas</p></div></article>
        <article className="metric-card"><div className="metric-icon purple">◈</div><div><span>Nível e sequência</span><strong>Nível {state.stats.level}</strong><p>{state.stats.streak} dias • {state.stats.xp} XP</p></div></article>
      </section>

      <section className="weekly-loop" id="weekly-checkin"><div><span className="weekly-kicker">DESAFIO DA SEMANA</span><h3>{state.diagnostic.active ? "Calibre sua rota em 10 questões" : "Feche a semana e recalibre"}</h3><p>{state.diagnostic.active ? "Cada resposta recalcula domínio, confiança e prioridade." : `Diagnóstico concluído. ${state.reviewQueue.length} item(ns) aguardam revisão.`}</p></div><div className="weekly-progress"><b>{state.diagnostic.answered}/{state.diagnostic.target}</b><i><span style={{ width: `${Math.min(100, (state.diagnostic.answered / state.diagnostic.target) * 100)}%` }} /></i>{state.diagnostic.active ? <button className="outline-button" type="button" onClick={() => router.push("/app/questoes")}>Continuar diagnóstico</button> : <button className="outline-button" type="button" onClick={() => { setCheckinHours(state.profile.weeklyHours); setCheckinOpen((value) => !value); }}>Fazer fechamento semanal</button>}</div></section>
      {checkinOpen && <section className="surface weekly-checkin-form"><div><p className="eyebrow">FECHAMENTO SEMANAL</p><h3>Como foi o ritmo desta semana?</h3><p>Use sua percepção junto com as evidências observadas para ajustar a próxima carga.</p></div><label>Ritmo percebido<select value={checkinPace} onChange={(event) => setCheckinPace(event.target.value as typeof checkinPace)}><option value="light">Leve — posso avançar mais</option><option value="balanced">Adequado — manter o ritmo</option><option value="heavy">Pesado — preciso reduzir</option></select></label><label>Horas disponíveis na próxima semana<input type="range" min="2" max="30" value={checkinHours} onChange={(event) => setCheckinHours(Number(event.target.value))} /><output>{checkinHours} horas</output></label><button className="primary-button" type="button" onClick={finishCheckin}>Confirmar e criar próxima semana →</button></section>}

      <GamificationPanel />

      <div className="dashboard-grid">
        <section className="panel week-panel"><div className="panel-head"><div><h3>Seu plano desta semana</h3><p>Recalculado pelas evidências mais recentes</p></div></div><div className="week-list">{state.plan.map((task) => { const date = new Date(task.scheduledFor); return <div className={`day ${task.status === "completed" ? "done" : ""}`} key={task.id}><div className="date"><b>{String(date.getDate()).padStart(2, "0")}</b><span>{dayLabels[date.getDay()]}</span></div><span className="day-line" /><div className="day-info"><b>{task.subject}</b><small>{task.topic} • {task.minutes} min</small></div><span className={`status ${task.status !== "completed" ? "neutral" : ""}`}>{task.status === "completed" ? "✓ Concluída" : "Planejada"}</span></div>; })}</div></section>
        <section className="panel priorities-panel"><div className="panel-head"><div><h3>Mapa de prioridades</h3><p>Domínio e confiança separados</p></div></div><div className="priority-list">{view.priorities.slice(0, 4).map((item, index) => <div className="priority-item" key={item.id}><div className={`ring ${item.priority >= 75 ? "high" : item.priority >= 60 ? "medium" : "low"}`}><span>{index + 1}</span></div><div><b>{item.subject}</b><small>Prioridade {item.priority}/100 • confiança {Math.round(item.confidence * 100)}%</small></div><strong>{Math.round(item.mastery * 100)}%</strong></div>)}</div></section>
      </div>

      <OnboardingModal open={shouldShowOnboarding} onClose={() => { setOnboardingOpen(false); setOnboardingDismissed(true); }} onComplete={() => router.push("/app/questoes")} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="next-content"><div className="surface empty-state">Preparando sua rota…</div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
