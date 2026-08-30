"use client";

import { useState } from "react";

export function PilotEnrollment({ code, onJoined }: { code: string | null; onJoined?: () => void }) {
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"pending" | "joining" | "joined">("pending");
  const [message, setMessage] = useState("");
  if (!code || status === "joined") return status === "joined" ? <section className="surface pilot-welcome"><b>Participação confirmada.</b><p>Obrigado. Conclua o onboarding e responda ao diagnóstico normalmente.</p></section> : null;

  async function join() {
    setStatus("joining"); setMessage("");
    const response = await fetch("/api/pilot/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, consent }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setStatus("joined"); onJoined?.(); return; }
    setStatus("pending"); setMessage(payload.error ?? "Não foi possível confirmar sua participação.");
  }

  return <section className="surface pilot-welcome"><p className="eyebrow">CONVITE PARA O PILOTO ENEM</p><h2>Antes de começar</h2><p>Este é um teste voluntário da experiência da Rota. Serão registrados eventos de uso, como conclusão do diagnóstico e das revisões, sem armazenar o texto das suas respostas na telemetria. Você pode solicitar sua saída a qualquer momento.</p><label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Li e aceito participar voluntariamente deste piloto.</label>{message && <p className="auth-message error">{message}</p>}<button className="primary-button" type="button" disabled={!consent || status === "joining"} onClick={() => void join()}>{status === "joining" ? "Confirmando…" : "Confirmar participação"}</button></section>;
}
