"use client";

import { useState } from "react";
import { useRota } from "@/components/providers/rota-provider";
import type { StudyTaskType } from "@/lib/domain/rota";

type Props = { open: boolean; onClose: () => void; onComplete?: () => void };

const careers = [
  ["enem-2026", "ENEM 2026 — 8 e 15 de novembro"],
  ["pmmg-cfsd", "PMMG — Soldado"],
  ["pmmg-cfo", "PMMG — Oficial"],
  ["federal-police", "Carreira policial federal"],
  ["courts", "Tribunais"],
  ["fiscal", "Carreira fiscal"],
  ["undecided", "Ainda estou escolhendo"],
] as const;

function toggle<T>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function OnboardingModal({ open, onClose, onComplete }: Props) {
  const { completeOnboarding } = useRota();
  const [step, setStep] = useState(1);
  const [career, setCareer] = useState("pmmg-cfsd");
  const [notice, setNotice] = useState<"pre_notice" | "published" | "file">("pre_notice");
  const [noticeFile, setNoticeFile] = useState<string | null>(null);
  const [education, setEducation] = useState("medio");
  const [stage, setStage] = useState("starting");
  const [interests, setInterests] = useState<string[]>(["policial"]);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState(7);
  const [availableDays, setAvailableDays] = useState([1, 2, 3, 5, 6]);
  const [preferredPeriod, setPreferredPeriod] = useState("morning");
  const [preferredFormats, setPreferredFormats] = useState<StudyTaskType[]>(["questions"]);
  const [strengths, setStrengths] = useState<string[]>([]);

  if (!open) return null;
  const careerLabel = careers.find(([value]) => value === career)?.[1] ?? "Concurso selecionado";
  const isEnem = career === "enem-2026";

  function selectCareer(value: string) {
    setCareer(value);
    if (value === "enem-2026") {
      setNotice("published");
      setExamDate("2026-11-08");
      setInterests((current) => current.includes("educacional") ? current : [...current, "educacional"]);
    }
  }

  function finish() {
    completeOnboarding({
      career,
      careerLabel,
      notice: isEnem ? "published" : notice,
      noticeFile,
      examDate: isEnem ? "2026-11-08" : examDate,
      education,
      stage,
      weeklyHours,
      availableDays,
      preferredPeriod,
      interests,
      preferredFormats,
      selfReportedStrengths: strengths,
    });
    onComplete?.();
    onClose();
  }

  return (
    <div className="diagnosis-backdrop open" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="diagnosis-card next-onboarding">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
        <div className="diagnosis-progress"><i style={{ width: `${step * 20}%` }} /></div>
        <p className="eyebrow">SUA ROTA • ETAPA {step} DE 5</p>

        {step === 1 && <section className="diagnosis-step active"><h2 id="onboarding-title">Qual caminho você quer seguir?</h2><p>Se ainda estiver escolhendo, começaremos pelos conteúdos mais reaproveitáveis.</p><label>Objetivo principal<select value={career} onChange={(event) => selectCareer(event.target.value)}>{careers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{isEnem ? <div className="trust-note">✓ ENEM 2026 confirmado para 8 e 15 de novembro. A rota usa o primeiro dia como prazo principal.</div> : <><label>Situação do edital<select value={notice} onChange={(event) => setNotice(event.target.value as typeof notice)}><option value="pre_notice">Ainda não foi publicado</option><option value="published">Edital publicado</option><option value="file">Tenho o edital em PDF</option></select></label>{notice === "file" && <label>Edital em PDF<input type="file" accept="application/pdf" onChange={(event) => setNoticeFile(event.target.files?.[0]?.name ?? null)} /></label>}</>}</section>}

        {step === 2 && <section className="diagnosis-step active"><h2 id="onboarding-title">Conte um pouco sobre você.</h2><p>Usamos essas informações para sugerir caminhos elegíveis, sem rotular seu potencial.</p><label>Formação atual<select value={education} onChange={(event) => setEducation(event.target.value)}><option value="medio">Ensino médio</option><option value="superior-cursando">Superior em andamento</option><option value="superior">Ensino superior</option><option value="pos">Pós-graduação</option></select></label><label>Momento nos estudos<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="starting">Começando agora</option><option value="returning">Voltando a estudar</option><option value="active">Já estudo com frequência</option><option value="advanced">Preparação avançada</option></select></label><div className="choice-group"><span>Áreas de interesse</span><div className="subject-picks">{[["educacional","ENEM / graduação"],["policial","Policial"],["juridica","Jurídica"],["fiscal","Fiscal"],["administrativa","Administrativa"]].map(([value,label]) => <label key={value}><input type="checkbox" checked={interests.includes(value)} onChange={() => setInterests(toggle(interests,value))} /> {label}</label>)}</div></div></section>}

        {step === 3 && <section className="diagnosis-step active"><h2 id="onboarding-title">Como é sua semana real?</h2><p>{isEnem ? "O plano será construído até o primeiro domingo de prova e considera o segundo dia." : "Sem data de prova, a Rota trabalha em ciclos móveis de quatro semanas."}</p><label>{isEnem ? "Primeiro dia do ENEM 2026" : "Data da prova, se definida"}<input type="date" value={isEnem ? "2026-11-08" : examDate ?? ""} readOnly={isEnem} onChange={(event) => setExamDate(event.target.value || null)} /></label><label>Horas por semana<input type="range" min="2" max="30" value={weeklyHours} onChange={(event) => setWeeklyHours(Number(event.target.value))} /><output>{weeklyHours} horas</output></label><div className="choice-group"><span>Dias disponíveis</span><div className="day-picks">{[[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"],[0,"Dom"]].map(([value,label]) => <label key={value}><input type="checkbox" checked={availableDays.includes(Number(value))} onChange={() => setAvailableDays(toggle(availableDays,Number(value)))} /> {label}</label>)}</div></div><label>Período preferido<select value={preferredPeriod} onChange={(event) => setPreferredPeriod(event.target.value)}><option value="morning">Manhã</option><option value="afternoon">Tarde</option><option value="evening">Noite</option><option value="variable">Varia</option></select></label></section>}

        {step === 4 && <section className="diagnosis-step active"><h2 id="onboarding-title">Como você prefere começar?</h2><p>Preferência é uma hipótese; depois comparamos com seu desempenho observado.</p><div className="choice-group"><span>Formatos mais usados</span><div className="subject-picks">{[["theory","Teoria"],["questions","Questões"],["review","Revisões"],["simulation","Simulados"]].map(([value,label]) => <label key={value}><input type="checkbox" checked={preferredFormats.includes(value as StudyTaskType)} onChange={() => setPreferredFormats(toggle(preferredFormats,value as StudyTaskType))} /> {label}</label>)}</div></div><div className="choice-group"><span>Facilidades percebidas</span><div className="subject-picks">{(isEnem ? ["Linguagens","Redação","Matemática","Ciências Humanas","Ciências da Natureza"] : ["Linguagens","Raciocínio Lógico","Direito","Conhecimentos Gerais"]).map((value) => <label key={value}><input type="checkbox" checked={strengths.includes(value)} onChange={() => setStrengths(toggle(strengths,value))} /> {value}</label>)}</div></div></section>}

        {step === 5 && <section className="diagnosis-step active"><h2 id="onboarding-title">Vamos medir seu ponto de partida.</h2><p>Domínio e confiança são calculados separadamente. Sua percepção inicial tem peso baixo até surgirem evidências.</p><div className="diagnosis-result"><span>PRÓXIMO PASSO</span><b>10 questões • cerca de 8 minutos</b><small>A rota será recalculada após cada resposta.</small></div><div className="trust-note">✓ Sem data de prova? Você entra automaticamente no modo pré-edital.</div></section>}

        <div className="diagnosis-actions"><button className="secondary-button" type="button" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}>Voltar</button><button className="primary-button" type="button" onClick={() => step === 5 ? finish() : setStep((value) => Math.min(5, value + 1))}>{step === 5 ? "Começar diagnóstico →" : "Continuar →"}</button></div>
      </div>
    </div>
  );
}
