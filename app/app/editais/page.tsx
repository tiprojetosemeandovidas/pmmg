"use client";

import { useRota } from "@/components/providers/rota-provider";
import { NoticeManager } from "@/components/notice-manager";

export default function NoticesPage() {
  const { state, view } = useRota();
  const evidence = Math.round((Object.values(state.mastery).filter((item) => item.confidence >= 0.2).length / Object.values(state.mastery).length) * 100);
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">CICLO ATIVO</p><h1>{state.profile.careerLabel}</h1><p>{state.profile.mode === "pre_notice" ? "Modo pré-edital: ciclos móveis de quatro semanas." : `${view.modeLabel}: o prazo participa do cálculo de prioridade.`}</p></div></header><div className="surface notice-card"><span className="subject-icon">◇</span><div><h2>{evidence ? `${evidence}% dos tópicos com evidência` : "Cobertura ainda em calibração"}</h2><p>Um edital validado importará banca, disciplinas, etapas e critérios eliminatórios para o plano.</p></div></div><NoticeManager /></div>;
}
