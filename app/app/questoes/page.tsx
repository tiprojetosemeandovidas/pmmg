"use client";

import { useEffect, useMemo, useState } from "react";
import { useRota } from "@/components/providers/rota-provider";
import { questionsForCareer } from "@/lib/data/questions";

type ExamArchive = { career: string; year: number; file: string; questionCount: number };

export default function QuestionsPage() {
  const { state, recordAnswer } = useRota();
  const [axis, setAxis] = useState("all");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [archive, setArchive] = useState<ExamArchive[]>([]);
  const isEnem = state.profile.career === "enem-2026";
  const careerQuestions = useMemo(() => questionsForCareer(state.profile.career), [state.profile.career]);
  const questions = useMemo(() => {
    const filtered = axis === "all" ? careerQuestions : careerQuestions.filter((item) => item.axis === axis);
    return filtered.length ? filtered : careerQuestions;
  }, [axis, careerQuestions]);
  const question = questions[index % questions.length];
  const selected = answers[question.id];

  useEffect(() => {
    fetch("/data/exams.json").then((response) => response.json()).then((data: ExamArchive[]) => setArchive(data)).catch(() => setArchive([]));
  }, []);

  function answer(option: number) {
    if (selected !== undefined) return;
    setAnswers((current) => ({ ...current, [question.id]: option }));
    recordAnswer(question, option, state.diagnostic.active ? "diagnostic" : "practice");
  }

  return <div className="next-content">
    <header className="page-header"><div><p className="eyebrow">{state.diagnostic.active ? "DIAGNÓSTICO ADAPTATIVO" : "BANCO DE QUESTÕES"}</p><h1>{state.diagnostic.active ? `Questão ${state.diagnostic.answered + 1} de ${state.diagnostic.target}` : "Treino direcionado"}</h1><p>Questões autorais e oficiais permanecem identificadas por origem.</p></div><div className="question-total"><b>{careerQuestions.length + (isEnem ? 0 : 1288)}</b><span>itens catalogados</span></div></header>
    <div className="axis-strip"><button className={`axis-card ${axis === "all" ? "active" : ""}`} onClick={() => { setAxis("all"); setIndex(0); }}>Todos</button>{[...new Set(careerQuestions.map((item) => item.axis))].map((item) => <button className={`axis-card ${axis === item ? "active" : ""}`} key={item} onClick={() => { setAxis(item); setIndex(0); }}>{item}</button>)}</div>
    <section className="question-area"><div className="question-toolbar"><div><span>QUESTÃO {index + 1} DE {questions.length}</span><b>{question.axis}</b></div><span className="source-pill">Autoral • validada para demonstração</span></div><article className="question-card"><div className="question-tags"><span>{question.exam}</span><span>{question.topic}</span><span>{question.difficulty}</span></div><h2>{question.text}</h2><div className="alternatives">{question.options.map((option, optionIndex) => { const answered = selected !== undefined; const className = answered && optionIndex === question.answer ? "correct" : answered && optionIndex === selected ? "wrong" : selected === optionIndex ? "selected" : ""; return <button className={`alternative ${className}`} type="button" key={option} onClick={() => answer(optionIndex)}><i>{String.fromCharCode(65 + optionIndex)}</i>{option}</button>; })}</div>{selected !== undefined && <div className="explanation"><b>{selected === question.answer ? "Resposta correta." : "Resposta incorreta."}</b> {question.explanation}</div>}</article><div className="question-nav"><button className="outline-button" type="button" onClick={() => setIndex((current) => (current - 1 + questions.length) % questions.length)}>← Anterior</button><div>{questions.map((item, itemIndex) => <i className={itemIndex === index ? "active" : ""} key={item.id} />)}</div><button className="primary-button" type="button" onClick={() => setIndex((current) => (current + 1) % questions.length)}>Próxima →</button></div></section>
    {isEnem ? <section className="archive-panel"><div className="panel-head"><div><h3>Trilha ENEM 2026</h3><p>10 itens autorais iniciais para calibrar as cinco áreas. Provas oficiais serão importadas com origem e gabarito auditáveis.</p></div><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem" target="_blank" rel="noreferrer">Fonte oficial ↗</a></div></section> : <section className="archive-panel"><div className="panel-head"><div><h3>Arquivo PMMG preservado</h3><p>Cadernos oficiais aguardam validação completa dos gabaritos</p></div><b>{archive.length || 32} provas</b></div><div className="archive-list">{archive.slice(0, 8).map((exam) => <a className="archive-item" href={`/provas/${exam.career === "CFSD" ? "cfsd" : "cfo"}/${exam.file}`} target="_blank" rel="noreferrer" key={`${exam.career}-${exam.year}-${exam.file}`}><span>PDF</span><div><b>{exam.career} {exam.year}</b><small>{exam.questionCount} questões extraídas</small></div><i>↗</i></a>)}</div></section>}
  </div>;
}
