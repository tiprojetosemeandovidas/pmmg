"use client";

import { useEffect, useState, type FormEvent } from "react";

type Feedback = { stage: string; ease_score: number; value_score: number; recommendation_score: number; comment: string | null };
type Participant = { id: string; invite_email: string; status: string; joined_at: string | null; eventTypes: string[]; feedback: Feedback[] };
type Cohort = { id: string; code: string; name: string; target_size: number; status: string; participants: Participant[] };

export function PilotCohortAdmin() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("Piloto ENEM — turma 1");
  const [code, setCode] = useState("enem-piloto-1");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/pilot", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setCohorts(payload.cohorts ?? []);
      setSelectedId((current) => current || payload.cohorts?.[0]?.id || "");
      setMessage("");
    } else setMessage(payload.error ?? "Painel do piloto indisponível.");
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  async function createCohort(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    const response = await fetch("/api/admin/pilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_cohort", name, code, targetSize: 10 }) });
    const payload = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível criar a coorte."); return; }
    setSelectedId(payload.data.id); setMessage("Coorte criada. Adicione os 10 e-mails convidados."); await load();
  }

  async function addParticipant(event: FormEvent) {
    event.preventDefault(); if (!selectedId) return; setBusy(true);
    const response = await fetch("/api/admin/pilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add_participant", cohortId: selectedId, email }) });
    const payload = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível adicionar o participante."); return; }
    setEmail(""); setMessage(`Participante incluído e convite enviado para ${payload.data.invite_email}.`); await load();
  }

  async function sendInvite(participant: Participant) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/pilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send_invite", participantId: participant.id }) });
    const payload = await response.json().catch(() => ({})); setBusy(false);
    setMessage(response.ok ? `Novo convite enviado para ${participant.invite_email}.` : payload.error ?? "Não foi possível reenviar o convite.");
  }

  async function copyAccessLink(participant: Participant) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/pilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "generate_invite_link", participantId: participant.id }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data?.actionLink) { setBusy(false); setMessage(payload.error ?? "Não foi possível gerar o link único."); return; }
    await navigator.clipboard.writeText(payload.data.actionLink);
    setBusy(false); setMessage(`Link único de ${participant.invite_email} copiado. Envie-o somente para essa pessoa.`);
  }

  const cohort = cohorts.find((item) => item.id === selectedId);
  const invitePath = cohort ? `/entrar?mode=signup&next=${encodeURIComponent(`/app?onboarding=1&pilot=${cohort.code}`)}` : "";
  const active = cohort?.participants.filter((item) => item.status === "active" || item.status === "completed").length ?? 0;
  const completedDiagnostics = cohort?.participants.filter((item) => item.eventTypes.includes("diagnostic_completed")).length ?? 0;
  const feedbackCount = cohort?.participants.reduce((sum, item) => sum + item.feedback.length, 0) ?? 0;

  return <div className="pilot-admin"><section className="surface pilot-setup"><form onSubmit={createCohort}><h3>Nova coorte</h3><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Código do convite<input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label><button className="primary-button" disabled={busy}>Criar coorte de 10</button></form><div><h3>Coorte selecionada</h3><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Selecione</option>{cohorts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{cohort && <><div className="pilot-invite"><code>{invitePath}</code><button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${invitePath}`)}>Copiar link</button></div><form onSubmit={addParticipant}><label>E-mail convidado<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="primary-button" disabled={busy || cohort.participants.length >= cohort.target_size}>Adicionar e enviar convite</button></form></>}</div></section>{message && <p className="opportunity-message" role="status">{message}</p>}{cohort && <><section className="operations-metrics"><article className="surface"><span>Convidados</span><strong>{cohort.participants.length}/{cohort.target_size}</strong></article><article className="surface"><span>Ativos</span><strong>{active}</strong></article><article className="surface"><span>Diagnóstico completo</span><strong>{completedDiagnostics}</strong></article><article className="surface"><span>Feedbacks</span><strong>{feedbackCount}</strong></article></section><section className="surface pilot-roster"><div className="panel-head"><div><h3>Participantes</h3><p>Acompanhamento operacional, sem respostas ou conteúdo privado.</p></div></div>{cohort.participants.length ? cohort.participants.map((participant) => <article key={participant.id}><div><b>{participant.invite_email}</b><small>{participant.joined_at ? `Entrou em ${new Intl.DateTimeFormat("pt-BR").format(new Date(participant.joined_at))}` : "Convite ainda não utilizado"}</small>{participant.status === "invited" && <><button className="auth-resend" type="button" disabled={busy} onClick={() => void sendInvite(participant)}>Reenviar por e-mail</button><button className="auth-resend" type="button" disabled={busy} onClick={() => void copyAccessLink(participant)}>Copiar link único</button></>}</div><span className={`status ${participant.status === "active" ? "good" : "neutral"}`}>{participant.status}</span><small>{participant.eventTypes.length} etapas registradas • {participant.feedback.length} feedback(s)</small></article>) : <div className="empty-state">Adicione os dez e-mails que participarão do teste.</div>}</section></>}</div>;
}
