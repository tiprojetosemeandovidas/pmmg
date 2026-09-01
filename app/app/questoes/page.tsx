"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRota } from "@/components/providers/rota-provider";
import { questionsForCareer, type PracticeQuestion } from "@/lib/data/questions";

type ExamArchive = { career: string; year: number; file: string; questionCount: number };
type QuestionSource = { name: string; url: string | null; official: boolean } | null;
type DisplayQuestion = Omit<PracticeQuestion, "answer" | "explanation"> & {
  topicId?: string;
  answer?: number;
  explanation?: string;
  source?: QuestionSource;
  persisted?: boolean;
};
type AnswerFeedback = { correct: boolean; correctOption: number; explanation: string | null };

function balanceByAxis(items: DisplayQuestion[]) {
  const groups = new Map<string, DisplayQuestion[]>();
  for (const item of items) groups.set(item.axis, [...(groups.get(item.axis) ?? []), item]);
  const balanced: DisplayQuestion[] = [];
  while ([...groups.values()].some((group) => group.length)) {
    for (const group of groups.values()) {
      const item = group.shift();
      if (item) balanced.push(item);
    }
  }
  return balanced;
}

function prioritizeByTopic(items: DisplayQuestion[], topicOrder: string[]) {
  const rank = new Map(topicOrder.map((topicId, index) => [topicId, index]));
  return [...items].sort((left, right) =>
    (rank.get(left.topicId ?? "") ?? topicOrder.length) - (rank.get(right.topicId ?? "") ?? topicOrder.length),
  );
}

const subscribeToLocation = () => () => undefined;
const simulationSnapshot = () => new URLSearchParams(window.location.search).get("mode") === "simulation";
const serverSimulationSnapshot = () => false;

export default function QuestionsPage() {
  const { state, view, recordAnswer, completeTask } = useRota();
  const [axis, setAxis] = useState("all");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>({});
  const [remoteQuestions, setRemoteQuestions] = useState<DisplayQuestion[]>([]);
  const [answering, setAnswering] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [diagnosticSessionId, setDiagnosticSessionId] = useState<string | null>(null);
  const [archive, setArchive] = useState<ExamArchive[]>([]);
  const [sessionTopicOrder, setSessionTopicOrder] = useState<string[]>([]);
  const simulationMode = useSyncExternalStore(subscribeToLocation, simulationSnapshot, serverSimulationSnapshot);
  const questionStartedAt = useRef(0);
  const priorityOrderRef = useRef(view.priorities.map((item) => item.id));
  const isEnem = state.profile.career === "enem-2026";
  const localQuestions = useMemo(() => questionsForCareer(state.profile.career), [state.profile.career]);
  const careerQuestions = useMemo<DisplayQuestion[]>(() => {
    const available = remoteQuestions.length >= 10 ? remoteQuestions : localQuestions;
    return state.diagnostic.active || simulationMode
      ? balanceByAxis(available)
      : prioritizeByTopic(available, sessionTopicOrder);
  }, [localQuestions, remoteQuestions, sessionTopicOrder, simulationMode, state.diagnostic.active]);
  const questions = useMemo(() => {
    const filtered = axis === "all" ? careerQuestions : careerQuestions.filter((item) => item.axis === axis);
    const available = filtered.length ? filtered : careerQuestions;
    return simulationMode ? available.slice(0, 10) : available;
  }, [axis, careerQuestions, simulationMode]);
  const question = questions[index % questions.length];
  const selected = answers[question.id];
  const result = feedback[question.id];

  useEffect(() => {
    fetch("/data/exams.json").then((response) => response.json()).then((data: ExamArchive[]) => setArchive(data)).catch(() => setArchive([]));
  }, []);

  useEffect(() => { priorityOrderRef.current = view.priorities.map((item) => item.id); }, [view.priorities]);

  useEffect(() => {
    let active = true;
    fetch(`/api/questions?career=${encodeURIComponent(state.profile.career)}&limit=100`)
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((payload: { data?: DisplayQuestion[] }) => {
        if (!active) return;
        setSessionTopicOrder(priorityOrderRef.current);
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

  async function answer(option: number, answeredAt: number) {
    if (selected !== undefined || answering) return;
    setAnswering(true);
    let answerResult: AnswerFeedback;
    if (question.persisted) {
      const response = await fetch("/api/candidate/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedOption: option, idempotencyKey: crypto.randomUUID(), responseTimeMs: questionStartedAt.current > 0 ? Math.round(answeredAt - questionStartedAt.current) : undefined, diagnosticSessionId: state.diagnostic.active ? diagnosticSessionId : null }),
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
    recordAnswer({ ...question, answer: answerResult.correctOption }, option, state.diagnostic.active ? "diagnostic" : simulationMode ? "simulation" : "practice");
    if (diagnosticSessionId && state.diagnostic.active && state.diagnostic.answered + 1 >= state.diagnostic.target) {
      void fetch(`/api/candidate/diagnostics/${diagnosticSessionId}/complete`, { method: "POST" });
    }
    setAnswering(false);
  }

  return <div className="next-content">
    <header className="page-header"><div><p className="eyebrow">{state.diagnostic.active ? "DIAGNÓSTICO ADAPTATIVO" : simulationMode ? "SIMULADO RÁPIDO" : "BANCO DE QUESTÕES"}</p><h1>{state.diagnostic.active ? `Questão ${state.diagnostic.answered + 1} de ${state.diagnostic.target}` : simulationMode ? `Questão ${Math.min(Object.keys(feedback).length + 1, 10)} de 10` : "Treino direcionado"}</h1><p>{state.diagnostic.active || simulationMode ? "Distribuição equilibrada entre as áreas disponíveis." : `Começando pela prioridade atual: ${view.priorities[0]?.subject}.`} Questões autorais e oficiais permanecem identificadas por origem.</p></div><div className="question-total"><b>{simulationMode ? Math.min(careerQuestions.length, 10) : careerQuestions.length}</b><span>itens nesta sessão</span></div></header>
    {loadMessage && <p className="auth-message" role="status">{loadMessage}</p>}
    <div className="axis-strip"><button className={`axis-card ${axis === "all" ? "active" : ""}`} onClick={(event) => { questionStartedAt.current = event.timeStamp; setAxis("all"); setIndex(0); }}>Todos</button>{[...new Set(careerQuestions.map((item) => item.axis))].map((item) => <button className={`axis-card ${axis === item ? "active" : ""}`} key={item} onClick={(event) => { questionStartedAt.current = event.timeStamp; setAxis(item); setIndex(0); }}>{item}</button>)}</div>
    <section className="question-area"><div className="question-toolbar"><div><span>QUESTÃO {index + 1} DE {questions.length}</span><b>{question.axis}</b></div><span className="source-pill">{question.source?.official ? "Oficial • origem auditada" : question.persisted ? "Validada pela curadoria" : "Autoral • demonstração"}</span></div><article className="question-card"><div className="question-tags"><span>{question.exam}</span><span>{question.topic}</span><span>{question.difficulty}</span></div><h2>{question.text}</h2><div className="alternatives">{question.options.map((option, optionIndex) => { const answered = selected !== undefined; const className = answered && optionIndex === result?.correctOption ? "correct" : answered && optionIndex === selected ? "wrong" : selected === optionIndex ? "selected" : ""; return <button className={`alternative ${className}`} disabled={answering} type="button" key={`${optionIndex}-${option}`} onClick={(event) => void answer(optionIndex, event.timeStamp)}><i>{String.fromCharCode(65 + optionIndex)}</i>{option}</button>; })}</div>{result && <div className="explanation"><b>{result.correct ? "Resposta correta." : "Resposta incorreta."}</b> {result.explanation}</div>}{question.source?.url && <a href={question.source.url} target="_blank" rel="noreferrer">Consultar fonte: {question.source.name} ↗</a>}</article><div className="question-nav"><button className="outline-button" type="button" onClick={(event) => { questionStartedAt.current = event.timeStamp; setIndex((current) => (current - 1 + questions.length) % questions.length); }}>← Anterior</button><div>{questions.map((item, itemIndex) => <i className={itemIndex === index ? "active" : ""} key={item.id} />)}</div><button className="primary-button" type="button" onClick={(event) => { questionStartedAt.current = event.timeStamp; setIndex((current) => (current + 1) % questions.length); }}>Próxima →</button></div></section>
    {!state.diagnostic.active && Object.keys(feedback).length >= (simulationMode ? 10 : 5) && view.nextAction.type !== "weekly_checkin" && <section className="surface session-completion"><div><p className="eyebrow">{simulationMode ? "SIMULADO CONCLUÍDO" : "SESSÃO COM EVIDÊNCIA"}</p><h3>{simulationMode ? `${Object.values(feedback).filter((item) => item.correct).length} de 10 acertos` : `${Object.keys(feedback).length} questões respondidas`}</h3><p>Seu domínio e suas prioridades já foram recalculados. Confirme a conclusão para registrar a sessão no plano.</p></div><button className="primary-button" type="button" disabled={view.nextAction.status === "completed"} onClick={() => { completeTask(view.nextAction.id); setLoadMessage("Sessão concluída. A próxima melhor ação já foi recalculada."); }}>{view.nextAction.status === "completed" ? "Sessão concluída ✓" : "Concluir sessão →"}</button></section>}
    {isEnem ? <section className="archive-panel"><div className="panel-head"><div><h3>Trilha ENEM 2026</h3><p>Questões oficiais do acervo histórico são distribuídas entre as áreas e identificadas por origem. O desempenho alimenta plano e revisões.</p></div><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem" target="_blank" rel="noreferrer">Fonte oficial ↗</a></div></section> : <section className="archive-panel"><div className="panel-head"><div><h3>Arquivo PMMG preservado</h3><p>Cadernos oficiais aguardam validação completa dos gabaritos</p></div><b>{archive.length || 32} provas</b></div><div className="archive-list">{archive.slice(0, 8).map((exam) => <a className="archive-item" href={`/provas/${exam.career === "CFSD" ? "cfsd" : "cfo"}/${exam.file}`} target="_blank" rel="noreferrer" key={`${exam.career}-${exam.year}-${exam.file}`}><span>PDF</span><div><b>{exam.career} {exam.year}</b><small>{exam.questionCount} questões extraídas</small></div><i>↗</i></a>)}</div></section>}
  </div>;
}
