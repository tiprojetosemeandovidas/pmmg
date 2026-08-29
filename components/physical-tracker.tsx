"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { calculatePhysicalProgress } from "@/lib/domain/physical-engine";
import { PHYSICAL_EVENTS, unitLabels } from "@/lib/progress/catalog";
import type { PhysicalGoal, PhysicalResult } from "@/lib/progress/types";

export function PhysicalTracker() {
  const { user, status: authStatus } = useAuth();
  const [goals, setGoals] = useState<PhysicalGoal[]>([]);
  const [results, setResults] = useState<PhysicalResult[]>([]);
  const [eventCode, setEventCode] = useState(PHYSICAL_EVENTS[0].code);
  const [targetValue, setTargetValue] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const progress = useMemo(() => calculatePhysicalProgress(goals, results), [goals, results]);
  const selectedEvent = PHYSICAL_EVENTS.find((event) => event.code === eventCode) ?? PHYSICAL_EVENTS[0];

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/physical", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const loadedGoals = (payload.goals ?? []) as PhysicalGoal[];
      setGoals(loadedGoals);
      setResults(payload.results ?? []);
      setTargetValue((current) => current || String(loadedGoals.find((item) => item.eventCode === PHYSICAL_EVENTS[0].code)?.targetValue ?? ""));
    }
    else setMessage(payload.error ?? "Não foi possível carregar suas medições.");
  }, [user]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  function selectEvent(code: string) {
    setEventCode(code);
    const goal = goals.find((item) => item.eventCode === code);
    setTargetValue(goal ? String(goal.targetValue) : "");
  }

  async function send(body: Record<string, unknown>) {
    if (!user) { setMessage("Entre para salvar metas e medições com segurança."); return false; }
    setBusy(true); setMessage("");
    const response = await fetch("/api/physical", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível salvar."); return false; }
    await load();
    return true;
  }

  async function saveGoal(event: FormEvent) {
    event.preventDefault();
    const value = Number(targetValue);
    if (!Number.isFinite(value) || value <= 0) return setMessage("Informe uma meta maior que zero.");
    if (await send({ action: "set_goal", eventCode, targetValue: value })) setMessage("Meta pessoal salva. Ela não substitui o requisito do edital.");
  }

  async function saveResult(event: FormEvent) {
    event.preventDefault();
    const value = Number(resultValue);
    if (!Number.isFinite(value) || value <= 0) return setMessage("Informe uma medição maior que zero.");
    if (await send({ action: "record_result", eventCode, value, measuredAt })) { setResultValue(""); setMessage("Medição registrada."); }
  }

  if (authStatus === "loading") return <div className="surface empty-state">Preparando acompanhamento físico…</div>;

  return <>
    {!user && <div className="surface taf-auth"><div><h2>Registre sua evolução com privacidade</h2><p>O modo demonstração não guarda dados físicos. Entre para criar metas pessoais e histórico.</p></div><Link className="primary-button link-button" href="/entrar?next=/app/taf">Entrar →</Link></div>}
    <section className="taf-overview">{PHYSICAL_EVENTS.map((event) => {
      const item = progress.find((entry) => entry.eventCode === event.code)!;
      return <article className={item.progress === 100 ? "ready" : ""} key={event.code}><header><span>{event.name}</span><b>{item.progress === null ? "—" : `${item.progress}%`}</b></header><div className="taf-progress"><i style={{ width: `${item.progress ?? 0}%` }} /></div><p>{item.currentValue === null ? "Sem medição" : `Atual: ${item.currentValue} ${unitLabels[event.unit]}`}</p><small>{item.targetValue === null ? "Defina uma meta pessoal" : `Meta: ${item.targetValue} ${unitLabels[event.unit]} • ${item.isOfficial ? "edital validado" : "pessoal"}`}</small></article>;
    })}</section>
    <section className="taf-workspace">
      <div className="surface taf-form-panel"><div className="panel-head"><div><h3>Meta e medição</h3><p>Escolha o exercício e atualize um dado de cada vez</p></div></div><label>Exercício<select value={eventCode} onChange={(event) => selectEvent(event.target.value)}>{PHYSICAL_EVENTS.map((event) => <option value={event.code} key={event.code}>{event.name}</option>)}</select></label><div className="taf-dual-form"><form onSubmit={saveGoal}><b>Meta pessoal</b><label>Valor em {unitLabels[selectedEvent.unit]}<input inputMode="decimal" min="0.01" max="100000" step="0.01" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></label><button className="secondary-button" disabled={busy || !user}>Salvar meta</button></form><form onSubmit={saveResult}><b>Nova medição</b><label>Resultado em {unitLabels[selectedEvent.unit]}<input inputMode="decimal" min="0.01" max="100000" step="0.01" value={resultValue} onChange={(event) => setResultValue(event.target.value)} /></label><label>Data<input type="date" max={new Date().toISOString().slice(0, 10)} value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label><button className="primary-button" disabled={busy || !user}>Registrar</button></form></div>{message && <p className="taf-message" role="status">{message}</p>}</div>
      <div className="surface taf-history"><div className="panel-head"><div><h3>Histórico recente</h3><p>Últimas medições registradas</p></div></div>{results.length === 0 ? <div className="empty-state">Nenhuma medição registrada.</div> : results.slice(0, 8).map((result) => { const event = PHYSICAL_EVENTS.find((item) => item.code === result.eventCode); return <div className="taf-history-row" key={result.id}><span>{event?.name ?? result.eventCode}<small>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${result.measuredAt}T12:00:00`))}</small></span><b>{result.value} {event ? unitLabels[event.unit] : ""}</b></div>; })}</div>
    </section>
    <section className="surface taf-safety"><b>Orientação responsável</b><p>Metas pessoais servem para acompanhar evolução. Antes de iniciar ou intensificar treino físico, procure avaliação profissional. Somente requisitos extraídos e revisados de um edital recebem o selo “edital validado”.</p></section>
  </>;
}
