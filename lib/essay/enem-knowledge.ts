export const ENEM_CORPUS_SOURCE = {
  title: "Coletânea de redações nota 1000 do Enem",
  publisher: "Exemplos publicados em cartilhas e materiais oficiais do Inep",
  scope: "16 redações integrais, edições de 2013 a 2023",
  note: "A plataforma usa padrões pedagógicos derivados; os textos dos participantes não são reproduzidos nem oferecidos para memorização.",
} as const;

export const ENEM_METHOD = [
  { id: "map", step: "1", title: "Mapeie o recorte", duration: "5 min", description: "Transforme o tema em problema, afetados e contexto brasileiro. Sublinhe cada palavra que limita o assunto." },
  { id: "thesis", step: "2", title: "Formule tese e dois eixos", duration: "7 min", description: "Assuma uma posição e anuncie duas causas, consequências ou barreiras que possam virar os parágrafos de desenvolvimento." },
  { id: "develop", step: "3", title: "Construa os argumentos", duration: "20 min", description: "Em cada desenvolvimento: tópico frasal, explicação causal, repertório relacionado, análise do vínculo e fechamento do eixo." },
  { id: "intervene", step: "4", title: "Feche com intervenção", duration: "8 min", description: "Defina agente, ação, meio, finalidade e um detalhamento. A solução precisa responder aos problemas discutidos e respeitar direitos humanos." },
  { id: "revise", step: "5", title: "Revise pelas competências", duration: "10 min", description: "Cheque norma-padrão, atendimento ao tema, organização, coesão e intervenção. Troque repetições; não enfeite o texto artificialmente." },
] as const;

export const CONNECTOR_FAMILIES = [
  { purpose: "Abrir argumento", examples: ["Em primeiro plano", "Inicialmente", "Sob essa perspectiva"] },
  { purpose: "Adicionar", examples: ["Além disso", "Ademais", "Somado a isso"] },
  { purpose: "Contrapor", examples: ["Entretanto", "Contudo", "Apesar disso"] },
  { purpose: "Explicar", examples: ["Isso ocorre porque", "Uma vez que", "Nesse contexto"] },
  { purpose: "Concluir efeito", examples: ["Dessa forma", "Desse modo", "Por conseguinte"] },
  { purpose: "Intervir", examples: ["Portanto", "Logo, cabe a", "Torna-se necessário, pois"] },
] as const;

export const REFERENCE_PATTERNS = [
  { title: "Marco jurídico", pattern: "norma → direito garantido → distância entre previsão e realidade", warning: "Confirme artigo e conteúdo; uma citação imprecisa enfraquece o argumento." },
  { title: "Conceito das Humanidades", pattern: "autor/obra → conceito em linguagem própria → aplicação direta ao problema", warning: "Não use nome famoso como decoração. Explique o vínculo causal." },
  { title: "Processo histórico", pattern: "fato contextualizado → permanência ou contraste atual → consequência para o tema", warning: "Evite analogias exageradas e datas que você não domina." },
  { title: "Obra cultural", pattern: "situação da obra → paralelo específico com o tema → leitura crítica", warning: "O repertório precisa ser legítimo, pertinente e produtivo." },
  { title: "Dado verificável", pattern: "fonte identificada → dado com recorte → interpretação, nunca dado solto", warning: "Não invente percentuais. Quando não souber, prefira um repertório seguro." },
] as const;

export const CORPUS_FINDINGS = [
  "A introdução contextualiza, delimita o problema e apresenta uma tese operacional.",
  "Os desenvolvimentos têm funções diferentes e retomam os eixos anunciados.",
  "O repertório é explicado e ligado ao raciocínio; não aparece como frase decorativa.",
  "A coesão combina conectivos com retomadas lexicais, pronomes e progressão de ideias.",
  "A conclusão deriva do diagnóstico e torna a intervenção executável.",
  "Não existe fórmula vocabular única: clareza e coerência importam mais que palavras raras.",
] as const;

export function buildEssayKnowledgeContext() {
  return JSON.stringify({ source: ENEM_CORPUS_SOURCE, method: ENEM_METHOD, connectors: CONNECTOR_FAMILIES, references: REFERENCE_PATTERNS, findings: CORPUS_FINDINGS });
}
