import type { Metadata } from "next";
import { EssayLab } from "@/components/essay-lab";

export const metadata: Metadata = { title: "Redações ENEM" };

export default function EssaysPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">TREINAMENTO ENEM</p><h1>Redações</h1><p>Aprenda os padrões de excelência, pratique com método e preserve sua própria voz.</p></div><span className="mentor-safety">✓ Base derivada de exemplos oficiais do Inep</span></header><EssayLab /></div>;
}
