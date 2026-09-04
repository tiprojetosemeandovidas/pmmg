"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { CONNECTOR_FAMILIES, CORPUS_FINDINGS, ENEM_CORPUS_SOURCE, ENEM_METHOD, REFERENCE_PATTERNS } from "@/lib/essay/enem-knowledge";
import type { EssayCoachResult } from "@/lib/essay/types";

const themes = [
  "Desafios para combater a desinformação científica no Brasil",
  "Caminhos para ampliar a inclusão digital da população idosa brasileira",
  "A importância da preservação da memória cultural nas cidades brasileiras",
];

export function EssayLab() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"method" | "connectors" | "references" | "studio">("method");
  const [theme, setTheme] = useState(themes[0]);
  const [essay, setEssay] = useState("");
  const [result, setResult] = useState<EssayCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const words = useMemo(() => essay.trim() ? essay.trim().split(/\s+/).length : 0, [essay]);

  async function submit(action: "feedback" | "model") {
    setMessage(""); setResult(null);
    if (!user) { setMessage("Entre na conta para usar a correção e a geração assistida."); return; }
    if (action === "feedback" && essay.trim().length < 200) { setMessage("Escreva ao menos 200 caracteres para receber uma análise útil."); return; }
    setLoading(true);
    const response = await fetch("/api/redacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, theme, essay: action === "feedback" ? essay : "" }) });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível concluir a análise."); return; }
    setResult(payload.result);
  }

  return <div className="essay-lab">
    <section className="essay-source-card"><div><span>BASE PEDAGÓGICA ANALISADA</span><h2>{ENEM_CORPUS_SOURCE.scope}</h2><p>{ENEM_CORPUS_SOURCE.publisher}. {ENEM_CORPUS_SOURCE.note}</p></div><div className="essay-source-score"><strong>5</strong><small>competências</small></div></section>

    <nav className="essay-tabs" aria-label="Módulos de redação">
      {([["method", "Método nota máxima"], ["connectors", "Conectivos"], ["references", "Repertório"], ["studio", "Laboratório IA"]] as const).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} type="button">{label}</button>)}
    </nav>

    {tab === "method" && <section className="essay-section"><header><div><p className="eyebrow">ROTINA DE 50 MINUTOS</p><h2>Da leitura do tema à revisão final</h2></div><p>Um processo repetível, não uma fórmula pronta.</p></header><div className="essay-method-grid">{ENEM_METHOD.map((item) => <article key={item.id}><span>{item.step}</span><div><small>{item.duration}</small><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div><div className="essay-findings"><h3>O que se repete nas 16 redações</h3>{CORPUS_FINDINGS.map((finding) => <p key={finding}>✓ {finding}</p>)}</div></section>}

    {tab === "connectors" && <section className="essay-section"><header><div><p className="eyebrow">COMPETÊNCIA 4</p><h2>Conectivo com função, não por enfeite</h2></div><p>A coesão nasce da relação lógica entre as frases.</p></header><div className="connector-grid">{CONNECTOR_FAMILIES.map((family) => <article key={family.purpose}><h3>{family.purpose}</h3><div>{family.examples.map((example) => <span key={example}>{example}</span>)}</div><p>Escreva primeiro a relação lógica; escolha o conector depois.</p></article>)}</div><div className="practice-callout"><b>Treino de substituição</b><p>Pegue um parágrafo seu, marque adição, oposição, causa e consequência. Se o conector não corresponder à relação, troque-o — sem alterar a ideia.</p></div></section>}

    {tab === "references" && <section className="essay-section"><header><div><p className="eyebrow">REPERTÓRIO PRODUTIVO</p><h2>Referência → vínculo → argumento</h2></div><p>O corretor precisa entender por que a referência prova sua tese.</p></header><div className="reference-grid">{REFERENCE_PATTERNS.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.pattern}</p><small>⚠ {item.warning}</small></article>)}</div><div className="practice-callout"><b>Teste dos três porquês</b><p>Por que esta referência é verdadeira? Por que pertence ao tema? Por que fortalece exatamente este argumento? Se faltar uma resposta, não use ainda.</p></div></section>}

    {tab === "studio" && <section className="essay-studio"><div className="essay-editor surface"><div className="panel-head"><div><p className="eyebrow">PRÁTICA DELIBERADA</p><h2>Escreva, receba evidências, reescreva</h2></div><span>{words} palavras</span></div><label>Tema<select value={theme} onChange={(event) => setTheme(event.target.value)}>{themes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Sua redação<textarea value={essay} onChange={(event) => setEssay(event.target.value)} rows={17} maxLength={12_000} placeholder="Comece pela contextualização e apresente sua tese…" /></label><div className="essay-editor-actions"><button className="primary-button" disabled={loading} onClick={() => void submit("feedback")} type="button">{loading ? "Analisando…" : "Corrigir meu texto"}</button><button className="secondary-button" disabled={loading} onClick={() => void submit("model")} type="button">Gerar modelo original</button></div>{message && <p className="essay-message">{message} {!user && <Link href="/entrar?next=/app/redacoes">Entrar →</Link>}</p>}<small>Estimativa pedagógica: somente o Inep atribui a nota oficial. Seu rascunho é enviado apenas quando você solicita análise.</small></div>
      <div className="essay-feedback">{!result ? <div className="surface essay-empty"><span>✎</span><h3>Seu diagnóstico aparecerá aqui</h3><p>A IA aponta evidências por competência, prioridades de reescrita, conectivos e repertórios possíveis.</p></div> : <article className="surface"><header><div><p className="eyebrow">DEVOLUTIVA</p><h2>{result.estimatedScore === null ? "Análise pedagógica" : `${result.estimatedScore} / 1000`}</h2></div><span>{result.mode === "model" ? "Modelo original" : "Estimativa"}</span></header><p>{result.summary}</p><div className="competency-list">{result.competencies.map((item) => <div key={item.id}><span><b>{item.id}</b><strong>{item.score}/200</strong></span><i><em style={{ width: `${item.score / 2}%` }} /></i><p>{item.evidence}</p><small>Próximo passo: {item.nextStep}</small></div>)}</div>{result.strengths.length > 0 && <div className="feedback-block"><b>Pontos fortes</b>{result.strengths.map((item) => <p key={item}>✓ {item}</p>)}</div>}{result.priorities.length > 0 && <div className="feedback-block"><b>Prioridades de reescrita</b>{result.priorities.map((item) => <p key={item}>→ {item}</p>)}</div>}{result.connectorSuggestions.length > 0 && <div className="feedback-block"><b>Coesão sugerida</b>{result.connectorSuggestions.map((item) => <p key={`${item.placement}-${item.suggestion}`}><strong>{item.suggestion}</strong> — {item.purpose}; {item.placement}</p>)}</div>}{result.referenceSuggestions.length > 0 && <div className="feedback-block"><b>Repertório possível</b>{result.referenceSuggestions.map((item) => <p key={item.reference}><strong>{item.reference}</strong> — {item.connection}. Verifique: {item.verification}</p>)}</div>}{result.essay && <div className="generated-essay"><b>Redação-modelo para estudo</b>{result.essay.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}<div className="feedback-block"><b>Plano estrutural</b>{result.outline.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</div><small className="essay-caveat">{result.caveat}</small></article>}</div>
    </section>}
  </div>;
}
