"use client";

import { useState, type FormEvent } from "react";

export function PilotFeedbackForm() {
  const [stage, setStage] = useState("onboarding");
  const [ease, setEase] = useState(3);
  const [value, setValue] = useState(3);
  const [recommendation, setRecommendation] = useState(7);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/pilot/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, easeScore: ease, valueScore: value, recommendationScore: recommendation, comment }) });
    const payload = await response.json().catch(() => ({})); setBusy(false);
    setMessage(response.ok ? "Feedback salvo. Obrigado por ajudar a melhorar a Rota." : payload.error ?? "Não foi possível salvar o feedback.");
  }

  return <form className="surface pilot-feedback" onSubmit={submit}><label>Momento do teste<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="onboarding">Após onboarding</option><option value="week_one">Fim da primeira semana</option><option value="final">Encerramento</option></select></label><label>Foi fácil entender o que fazer? <b>{ease}/5</b><input type="range" min="1" max="5" value={ease} onChange={(event) => setEase(Number(event.target.value))} /></label><label>O plano parece útil para sua preparação? <b>{value}/5</b><input type="range" min="1" max="5" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label><label>De 0 a 10, indicaria a Rota? <b>{recommendation}/10</b><input type="range" min="0" max="10" value={recommendation} onChange={(event) => setRecommendation(Number(event.target.value))} /></label><label>O que mais atrapalhou ou ajudou?<textarea rows={5} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>{message && <p className="opportunity-message" role="status">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Enviar feedback"}</button></form>;
}
