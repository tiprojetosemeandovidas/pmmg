import type { Metadata } from "next";
import { OpportunityExplorer } from "@/components/opportunity-explorer";

export const metadata: Metadata = { title: "Oportunidades compatíveis" };

export default function OpportunitiesPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">MAPA DE OPORTUNIDADES</p><h1>Seu estudo abre mais de uma porta.</h1><p>Compare trilhas pelo conteúdo reaproveitável, sua prontidão e os requisitos que ainda precisam ser confirmados.</p></div></header><OpportunityExplorer /></div>;
}
