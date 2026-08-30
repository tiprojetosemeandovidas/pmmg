import type { Metadata } from "next";
import { PilotFeedbackForm } from "@/components/pilot-feedback-form";

export const metadata: Metadata = { title: "Feedback do piloto" };

export default function PilotFeedbackPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">PILOTO ENEM</p><h1>Conte como foi sua experiência</h1><p>Leva menos de dois minutos e não altera seu plano ou desempenho.</p></div></header><PilotFeedbackForm /></div>;
}
