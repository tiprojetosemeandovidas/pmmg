"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRota } from "@/components/providers/rota-provider";
import { calculateOpportunityMatches } from "@/lib/domain/opportunity-engine";
import type { TrackedOpportunity } from "@/lib/opportunities/types";

const filters = [
  ["all", "Todas"], ["policial", "Policial"], ["juridica", "Jurídica"],
  ["fiscal", "Fiscal"], ["administrativa", "Administrativa"], ["educacional", "ENEM"],
] as const;

export function OpportunityExplorer() {
  const { state } = useRota();
  const { user, status: authStatus } = useAuth();
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all");
  const [tracked, setTracked] = useState<Record<string, TrackedOpportunity["status"]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const matches = useMemo(() => calculateOpportunityMatches(state), [state]);
  const visible = filter === "all" ? matches : matches.filter((item) => item.track.area === filter);
  const alternative = matches.find((item) => !item.isCurrent) ?? matches[0];

  useEffect(() => {
    if (!user) return;
    void fetch("/api/opportunities", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setTracked(Object.fromEntries((payload.tracked ?? []).map((item: TrackedOpportunity) => [item.trackCode, item.status])));
    });
  }, [user]);

  async function toggle(trackCode: string) {
    if (!user) {
      setMessage("Entre na sua conta para acompanhar trilhas em qualquer dispositivo.");
      return;
    }
    setBusy(trackCode);
    setMessage("");
    const active = Boolean(tracked[trackCode]);
    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackCode, status: active ? "removed" : "watching" }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage(payload.error ?? "Não foi possível atualizar a trilha.");
      return;
    }
    setTracked((current) => {
      const next = { ...current };
      if (active) delete next[trackCode]; else next[trackCode] = "watching";
      return next;
    });
  }

  return <>
    <section className="opportunity-summary">
      <div><span>ALTERNATIVA MAIS COMPATÍVEL</span><h2>{alternative.track.title}</h2><p>{alternative.explanation}</p></div>
      <div className="opportunity-score"><strong>{alternative.compatibility}</strong><small>% compatível</small></div>
      <div className="opportunity-summary-meta"><span><b>{alternative.reusableTopics.length}</b> áreas reaproveitáveis</span><span><b>{alternative.readiness}%</b> prontidão estimada</span><span><b>{alternative.confidence}%</b> confiança atual</span></div>
    </section>

    <div className="opportunity-toolbar">
      <div className="opportunity-filters" aria-label="Filtrar por área">{filters.map(([value, label]) => <button className={filter === value ? "active" : ""} type="button" key={value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <span>{tracked ? Object.keys(tracked).length : 0} acompanhada(s)</span>
    </div>

    {message && <div className="opportunity-message" role="status">{message} {!user && <Link href="/entrar?next=/app/oportunidades">Entrar →</Link>}</div>}

    <section className="opportunity-grid">{visible.map((match) => <article className={`opportunity-card ${match.isCurrent ? "current" : ""}`} key={match.track.code}>
      <header><div><span className="opportunity-area">{match.track.area} • {match.track.scope}</span><h3>{match.track.title}</h3><p>{match.track.institution}</p></div>{match.isCurrent ? <i>Objetivo atual</i> : tracked[match.track.code] ? <i className="watching">Acompanhando</i> : null}</header>
      <p className="opportunity-description">{match.track.summary}</p>
      <div className="opportunity-bars"><div><span>Compatibilidade estrutural <b>{match.compatibility}%</b></span><i><b style={{ width: `${match.compatibility}%` }} /></i></div><div><span>Prontidão observada <b>{match.readiness}%</b></span><i><b style={{ width: `${match.readiness}%` }} /></i></div></div>
      <div className="opportunity-facts"><span>{match.track.educationRequirement === "none" ? "Participação sem escolaridade mínima" : match.track.educationRequirement === "superior" ? "Superior" : "Ensino médio"} <small>{match.eligibility === "attention" ? "verifique o requisito" : "compatível com o perfil"}</small></span><span>{match.track.hasPhysicalTest ? "Pode incluir etapa física" : "Sem etapa física na trilha-base"}</span></div>
      <div className="opportunity-gaps"><b>Maiores ganhos possíveis</b>{match.gaps.map((gap) => <span key={gap.topicId}>{gap.label}<small>impacto {gap.impact}/100</small></span>)}</div>
      <footer><small>Confiança das evidências: {match.confidence}%</small>{!match.isCurrent && <button className="secondary-button" type="button" disabled={busy === match.track.code || authStatus === "loading"} onClick={() => void toggle(match.track.code)}>{busy === match.track.code ? "Salvando…" : tracked[match.track.code] ? "Deixar de acompanhar" : "Acompanhar trilha"}</button>}</footer>
    </article>)}</section>

    <p className="opportunity-disclaimer">Compatibilidade não significa inscrição aberta nem elegibilidade garantida. Requisitos, disciplinas e etapas devem ser confirmados no edital oficial validado.</p>
  </>;
}
