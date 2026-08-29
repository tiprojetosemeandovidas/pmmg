import type { QuestionEvidence } from "@/lib/domain/rota";

export type PracticeQuestion = QuestionEvidence & {
  id: string;
  exam: string;
  options: string[];
  explanation: string;
  sourceType: "manually_created" | "official_exam";
};

export const diagnosticQuestions: PracticeQuestion[] = [
  {
    id: "diag-1",
    axis: "Linguagens",
    exam: "Autoral • Diagnóstico",
    difficulty: "Média",
    topic: "Interpretação textual",
    text: "Em um texto argumentativo, qual elemento apresenta diretamente a posição defendida pelo autor?",
    options: ["A tese central", "A referência bibliográfica", "O título", "A descrição do suporte"],
    answer: 0,
    explanation: "A tese é a ideia central sustentada por argumentos.",
    sourceType: "manually_created",
  },
  {
    id: "diag-2",
    axis: "Raciocínio Lógico",
    exam: "Autoral • Diagnóstico",
    difficulty: "Fácil",
    topic: "Proposições",
    text: "Se todo candidato aprovado concluiu o curso e Ana foi aprovada, o que decorre necessariamente?",
    options: ["Ana iniciou o curso", "Ana concluiu o curso", "Ana foi a primeira", "Ana mudou de concurso"],
    answer: 1,
    explanation: "A conclusão decorre diretamente da implicação apresentada.",
    sourceType: "manually_created",
  },
  {
    id: "diag-3",
    axis: "Direito",
    exam: "Autoral • Diagnóstico",
    difficulty: "Média",
    topic: "Direitos fundamentais",
    text: "Segundo a Constituição Federal, a manifestação do pensamento é livre, sendo:",
    options: ["Permitido o anonimato", "Vedado o anonimato", "Exigida autorização", "Restrita a agentes públicos"],
    answer: 1,
    explanation: "O art. 5º, IV, assegura a manifestação e veda o anonimato.",
    sourceType: "manually_created",
  },
  {
    id: "diag-4",
    axis: "Legislação Policial",
    exam: "Autoral • Diagnóstico",
    difficulty: "Difícil",
    topic: "Ética e disciplina",
    text: "Em matéria disciplinar, a motivação de uma decisão administrativa serve principalmente para:",
    options: ["Dispensar a apuração", "Demonstrar fundamentos de fato e de direito", "Substituir a defesa", "Manter sigilo"],
    answer: 1,
    explanation: "A motivação explicita as razões da decisão e permite seu controle.",
    sourceType: "manually_created",
  },
  {
    id: "diag-5",
    axis: "Conhecimentos Gerais",
    exam: "Autoral • Diagnóstico",
    difficulty: "Fácil",
    topic: "Cidadania e atualidades",
    text: "O exercício da cidadania em uma democracia inclui:",
    options: ["Somente o voto", "Participação social e acompanhamento de políticas", "Apenas cargo público", "Renúncia ao debate"],
    answer: 1,
    explanation: "Cidadania abrange participação, fiscalização, direitos e deveres.",
    sourceType: "manually_created",
  },
  {
    id: "diag-6",
    axis: "Direito",
    exam: "Autoral • Diagnóstico",
    difficulty: "Difícil",
    topic: "Direitos fundamentais",
    text: "O princípio que exige atuação administrativa sem favorecimentos pessoais é o da:",
    options: ["Publicidade", "Eficiência", "Impessoalidade", "Continuidade"],
    answer: 2,
    explanation: "A impessoalidade orienta a Administração ao interesse público.",
    sourceType: "manually_created",
  },
  {
    id: "diag-7",
    axis: "Linguagens",
    exam: "Autoral • Diagnóstico",
    difficulty: "Difícil",
    topic: "Interpretação textual",
    text: "Em um argumento, uma informação que enfraquece diretamente a conclusão funciona como:",
    options: ["Contraexemplo relevante", "Recurso tipográfico", "Citação favorável", "Repetição da premissa"],
    answer: 0,
    explanation: "O contraexemplo apresenta um caso incompatível com a generalização.",
    sourceType: "manually_created",
  },
  {
    id: "diag-8",
    axis: "Raciocínio Lógico",
    exam: "Autoral • Diagnóstico",
    difficulty: "Média",
    topic: "Proposições",
    text: "A negação de “Todos os candidatos entregaram o documento” é:",
    options: ["Nenhum entregou", "Todos deixaram de entregar", "Pelo menos um não entregou", "Alguns entregaram"],
    answer: 2,
    explanation: "A negação universal afirma a existência de pelo menos um caso contrário.",
    sourceType: "manually_created",
  },
  {
    id: "diag-9",
    axis: "Legislação Policial",
    exam: "Autoral • Diagnóstico",
    difficulty: "Média",
    topic: "Ética e disciplina",
    text: "Em um processo administrativo, o contraditório assegura principalmente:",
    options: ["Decisão automática", "Conhecimento e possibilidade de reação", "Sigilo absoluto", "Dispensa de motivação"],
    answer: 1,
    explanation: "Contraditório envolve ciência dos atos e oportunidade de manifestação.",
    sourceType: "manually_created",
  },
  {
    id: "diag-10",
    axis: "Conhecimentos Gerais",
    exam: "Autoral • Diagnóstico",
    difficulty: "Média",
    topic: "Cidadania e atualidades",
    text: "Qual prática fortalece o controle social das políticas públicas?",
    options: ["Acompanhar portais e conselhos", "Evitar dados governamentais", "Restringir debates", "Substituir eleições"],
    answer: 0,
    explanation: "Transparência e participação permitem acompanhar e fiscalizar políticas.",
    sourceType: "manually_created",
  },
];

export const enemDiagnosticQuestions: PracticeQuestion[] = [
  { id: "enem-diag-1", axis: "Linguagens", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Interpretação textual", text: "Em uma campanha, a frase ‘Cada gota conta’ combina linguagem verbal e uma imagem de reservatório vazio. O efeito principal dessa relação é:", options: ["decorar a mensagem", "reforçar a urgência do consumo consciente", "substituir o argumento", "informar o volume do reservatório"], answer: 1, explanation: "A imagem contextualiza a frase e intensifica o apelo ao uso consciente da água.", sourceType: "manually_created" },
  { id: "enem-diag-2", axis: "Redação", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Texto dissertativo-argumentativo", text: "Qual trecho cumpre melhor a função de tese em uma redação sobre exclusão digital?", options: ["A internet surgiu no século XX.", "Há muitos aparelhos no mercado.", "A exclusão digital limita o acesso a direitos e exige políticas de conectividade e formação.", "Tecnologia é uma palavra de origem grega."], answer: 2, explanation: "A alternativa apresenta uma posição clara e antecipa dois eixos argumentativos.", sourceType: "manually_created" },
  { id: "enem-diag-3", axis: "Matemática", exam: "ENEM • treino autoral", difficulty: "Fácil", topic: "Resolução de problemas", text: "Uma assinatura de R$ 80 recebeu desconto de 15%. Qual é o novo preço?", options: ["R$ 12", "R$ 65", "R$ 68", "R$ 72"], answer: 2, explanation: "Quinze por cento de 80 é 12; portanto, 80 − 12 = 68.", sourceType: "manually_created" },
  { id: "enem-diag-4", axis: "Ciências Humanas", exam: "ENEM • treino autoral", difficulty: "Média", topic: "História e processos sociais", text: "A ampliação de direitos trabalhistas no Brasil do século XX alterou a relação entre Estado e trabalhadores principalmente ao:", options: ["eliminar conflitos sociais", "institucionalizar garantias e formas de mediação", "encerrar a urbanização", "abolir o trabalho assalariado"], answer: 1, explanation: "A legislação institucionalizou direitos e mecanismos de regulação das relações de trabalho.", sourceType: "manually_created" },
  { id: "enem-diag-5", axis: "Ciências Humanas", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Geografia e espaço brasileiro", text: "A impermeabilização intensa do solo urbano tende a aumentar:", options: ["a infiltração da chuva", "a recarga imediata dos aquíferos", "o escoamento superficial e o risco de alagamentos", "a cobertura vegetal"], answer: 2, explanation: "Superfícies impermeáveis reduzem a infiltração e aceleram o escoamento da água.", sourceType: "manually_created" },
  { id: "enem-diag-6", axis: "Ciências Humanas", exam: "ENEM • treino autoral", difficulty: "Difícil", topic: "Filosofia e sociologia", text: "Quando uma norma é aceita apenas por hábito, sem reflexão crítica, uma análise sociológica investiga sobretudo:", options: ["a composição química", "o processo de naturalização social", "a órbita terrestre", "o cálculo de probabilidades"], answer: 1, explanation: "Naturalização é o processo pelo qual construções históricas passam a parecer naturais ou inevitáveis.", sourceType: "manually_created" },
  { id: "enem-diag-7", axis: "Ciências da Natureza", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Biologia", text: "A vacinação contribui para a proteção coletiva porque:", options: ["elimina qualquer mutação", "reduz a circulação do agente infeccioso", "substitui hábitos de higiene", "impede toda resposta inflamatória"], answer: 1, explanation: "Ao reduzir pessoas suscetíveis e transmissões, a vacinação diminui a circulação do agente.", sourceType: "manually_created" },
  { id: "enem-diag-8", axis: "Ciências da Natureza", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Física", text: "Mantida a massa, um carro que dobra sua velocidade passa a ter energia cinética:", options: ["duas vezes maior", "quatro vezes maior", "igual", "oito vezes menor"], answer: 1, explanation: "A energia cinética é proporcional ao quadrado da velocidade; dobrá-la multiplica a energia por quatro.", sourceType: "manually_created" },
  { id: "enem-diag-9", axis: "Ciências da Natureza", exam: "ENEM • treino autoral", difficulty: "Média", topic: "Química", text: "Adicionar água a uma solução, sem alterar a quantidade de soluto, provoca:", options: ["aumento da concentração", "diminuição da concentração", "formação obrigatória de gás", "mudança do soluto"], answer: 1, explanation: "A diluição aumenta o volume do solvente e reduz a concentração do soluto.", sourceType: "manually_created" },
  { id: "enem-diag-10", axis: "Matemática", exam: "ENEM • treino autoral", difficulty: "Difícil", topic: "Resolução de problemas", text: "Uma população de 20 mil habitantes cresce 10% ao ano. Mantida a taxa por dois anos, qual será a população aproximada?", options: ["22 mil", "23 mil", "24,2 mil", "24,4 mil"], answer: 2, explanation: "O crescimento é composto: 20.000 × 1,1 × 1,1 = 24.200.", sourceType: "manually_created" },
];

export function questionsForCareer(career: string) {
  return career === "enem-2026" ? enemDiagnosticQuestions : diagnosticQuestions;
}
