"use client";

import { useEffect, useMemo, useState } from "react";
import { useRota } from "@/components/providers/rota-provider";
import { questionsForCareer, type PracticeQuestion } from "@/lib/data/questions";

type ExamArchive = { career: string; year: number; file: string; questionCount: number };
type QuestionSource = { name: string; url: string | null; official: boolean } | null;
type DisplayQuestion = Omit<PracticeQuestion, "answer" | "explanation"> & {
  answer?: number;
  explanation?: string;
  source?: QuestionSource;
  persisted?: boolean;
};
type AnswerFeedback = { correct: boolean; correctOption: number; explanation: string | null };

export default function QuestionsPage() {
  const { state, recordAnswer } = useRota();
  const [axis, setAxis] = useState("all");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>({});
  const [remoteQuestions, setRemoteQuestions] = useState<DisplayQuestion[]>([]);
  const [answering, setAnswering] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [diagnosticSessionId, setDiagnosticSessionId] = useState<string | null>(null);
  const [archive, setArchive] = useState<ExamArchive[]>([]);
  const isEnem = state.profile.career === "enem-2026";
  const localQuestions = useMemo(() => questionsForCareer(state.profile.career), [state.profile.career]);
  const careerQuestions = useMemo<DisplayQuestion[]>(() => remoteQuestions.length >= 10 ? remoteQuestions : localQuestions, [localQuestions, remoteQuestions]);
  const questions = useMemo(() => {
    const filtered = axis === "all" ? careerQuestions : careerQuestions.filter((item) => item.axis === axis);
    return filtered.length ? filtered : careerQuestions;
  }, [axis, careerQuestions]);
  const question = questions[index % questions.length];
  const selected = answers[question.id];
  const result = feedback[question.id];

  useEffect(() => {
    fetch("/data/exams.json").then((response) => response.json()).then((data: ExamArchive[]) => setArchive(data)).catch(() => setArchive([]));
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/questions?career=${encodeURIComponent(state.profile.career)}&limit=100`)
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((payload: { data?: DisplayQuestion[] }) => {
        if (!active) return;
        setRemoteQuestions((payload.data ?? []).map((item) => ({ ...item, persisted: true })));
        setLoadMessage((payload.data?.length ?? 0) >= 10 ? "" : "Usando o conjunto autoral de demonstração até haver ao menos 10 questões validadas no acervo.");
      })
      .catch(() => { if (active) setLoadMessage("Usando o conjunto autoral local; entre na conta para carregar o acervo persistido."); });
    return () => { active = false; };
  }, [state.profile.career]);

  useEffect(() => {
    if (!state.diagnostic.active || remoteQuestions.length < state.diagnostic.target || diagnosticSessionId) return;
    fetch("/api/candidate/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionCount: state.diagnostic.target }) })
      .then((response) => response.json()).then((payload: { data?: { id: string } }) => setDiagnosticSessionId(payload.data?.id ?? null)).catch(() => undefined);
  }, [diagnosticSessionId, remoteQuestions.length, state.diagnostic.active, state.diagnostic.target]);

  async function answer(option: number) {
    if (selected !== undefined || answering) return;
    setAnswering(true);
    let answerResult: AnswerFeedback;
    if (question.persisted) {
      const response = await fetch("/api/candidate/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedOption: option, idempotencyKey: crypto.randomUUID(), diagnosticSessionId: state.diagnostic.active ? diagnosticSessionId : null }),
      });
      const payload = await response.json().catch(() => ({})) as { data?: AnswerFeedback; error?: string };
      if (!response.ok || !payload.data) {
        setLoadMessage(payload.error ?? "Não foi possível registrar a resposta. Tente novamente.");
        setAnswering(false);
        return;
      }
      answerResult = payload.data;
    } else {
      answerResult = { correct: option === question.answer, correctOption: question.answer ?? 0, explanation: question.explanation ?? null };
    }
    setAnswers((current) => ({ ...current, [question.id]: option }));
    setFeedback((current) => ({ ...current, [question.id]: answerResult }));
    recordAnswer({ ...question, answer: answerResult.correctOption }, option, state.diagnostic.active ? "diagnostic" : "practice");
    if (diagnosticSessionId && state.diagnostic.active && state.diagnostic.answered + 1 >= state.diagnostic.target) {
      void fetch(`/api/candidate/diagnostics/${diagnosticSessionId}/complete`, { method: "POST" });
    }
    setAnswering(false);
  }

  return <div className="next-content">
    <header className="page-header"><div><p className="eyebrow">{state.diagnostic.active ? "DIAGNÓSTICO ADAPTATIVO" : "BANCO DE QUESTÕES"}</p><h1>{state.diagnostic.active ? `Questão ${state.diagnostic.answered + 1} de ${state.diagnostic.target}` : "Treino direcionado"}</h1><p>Questões autorais e oficiais permanecem identificadas por origem.</p></div><div className="question-total"><b>{careerQuestions.length + (isEnem ? 0 : 1288)}</b><span>itens catalogados</span></div></header>
    {loadMessage && <p className="auth-message" role="status">{loadMessage}</p>}
    <div className="axis-strip"><button className={`axis-card ${axis === "all" ? "active" : ""}`} onClick={() => { setAxis("all"); setIndex(0); }}>Todos</button>{[...new Set(careerQuestions.map((item) => item.axis))].map((item) => <button className={`axis-card ${axis === item ? "active" : ""}`} key={item} onClick={() => { setAxis(item); setIndex(0); }}>{item}</button>)}</div>
    <section className="question-area"><div className="question-toolbar"><div><span>QUESTÃO {index + 1} DE {questions.length}</span><b>{question.axis}</b></div><span className="source-pill">{question.source?.official ? "Oficial • origem auditada" : question.persisted ? "Validada pela curadoria" : "Autoral • demonstração"}</span></div><article className="question-card"><div className="question-tags"><span>{question.exam}</span><span>{question.topic}</span><span>{question.difficulty}</span></div><h2>{question.text}</h2><div className="alternatives">{question.options.map((option, optionIndex) => { const answered = selected !== undefined; const className = answered && optionIndex === result?.correctOption ? "correct" : answered && optionIndex === selected ? "wrong" : selected === optionIndex ? "selected" : ""; return <button className={`alternative ${className}`} disabled={answering} type="button" key={`${optionIndex}-${option}`} onClick={() => void answer(optionIndex)}><i>{String.fromCharCode(65 + optionIndex)}</i>{option}</button>; })}</div>{result && <div className="explanation"><b>{result.correct ? "Resposta correta." : "Resposta incorreta."}</b> {result.explanation}</div>}{question.source?.url && <a href={question.source.url} target="_blank" rel="noreferrer">Consultar fonte: {question.source.name} ↗</a>}</article><div className="question-nav"><button className="outline-button" type="button" onClick={() => setIndex((current) => (current - 1 + questions.length) % questions.length)}>← Anterior</button><div>{questions.map((item, itemIndex) => <i className={itemIndex === index ? "active" : ""} key={item.id} />)}</div><button className="primary-button" type="button" onClick={() => setIndex((current) => (current + 1) % questions.length)}>Próxima →</button></div></section>
    {isEnem ? <section className="archive-panel"><div className="panel-head"><div><h3>Trilha ENEM 2026</h3><p>10 itens autorais iniciais para calibrar as cinco áreas. Provas oficiais serão importadas com origem e gabarito auditáveis.</p></div><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem" target="_blank" rel="noreferrer">Fonte oficial ↗</a></div></section> : <section className="archive-panel"><div className="panel-head"><div><h3>Arquivo PMMG preservado</h3><p>Cadernos oficiais aguardam validação completa dos gabaritos</p></div><b>{archive.length || 32} provas</b></div><div className="archive-list">{archive.slice(0, 8).map((exam) => <a className="archive-item" href={`/provas/${exam.career === "CFSD" ? "cfsd" : "cfo"}/${exam.file}`} target="_blank" rel="noreferrer" key={`${exam.career}-${exam.year}-${exam.file}`}><span>PDF</span><div><b>{exam.career} {exam.year}</b><small>{exam.questionCount} questões extraídas</small></div><i>↗</i></a>)}</div></section>}
  </div>;
}
