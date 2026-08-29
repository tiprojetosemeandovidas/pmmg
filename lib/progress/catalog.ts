import type { PhysicalEvent } from "@/lib/progress/types";

export const PHYSICAL_EVENTS: PhysicalEvent[] = [
  { code: "run_12m", name: "Corrida de 12 minutos", unit: "m", direction: "higher", description: "Distância total percorrida em doze minutos." },
  { code: "pull_ups", name: "Barra fixa", unit: "repeticoes", direction: "higher", description: "Repetições completas conforme o protocolo usado no treino." },
  { code: "push_ups", name: "Flexão de braços", unit: "repeticoes", direction: "higher", description: "Repetições completas, sem presumir regra de edital." },
  { code: "sit_ups", name: "Abdominal", unit: "repeticoes", direction: "higher", description: "Repetições no tempo e protocolo definidos pelo acompanhamento." },
  { code: "shuttle_run", name: "Shuttle run", unit: "segundos", direction: "lower", description: "Tempo total; neste evento, menor resultado representa evolução." },
];

export const unitLabels: Record<PhysicalEvent["unit"], string> = {
  m: "metros",
  repeticoes: "repetições",
  segundos: "segundos",
};
