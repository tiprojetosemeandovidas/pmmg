import type { Metadata } from "next";
import { MentorChat } from "@/components/mentor-chat";

export const metadata: Metadata = { title: "Mentor IA" };

export default function MentorPage() {
  return <div className="next-content mentor-page"><header className="page-header"><div><p className="eyebrow">ORIENTAÇÃO COM EVIDÊNCIAS</p><h1>Mentor IA</h1><p>Converse com sua rota. Toda recomendação pessoal mostra as fontes utilizadas.</p></div><span className="mentor-safety">✓ Você mantém o controle do plano</span></header><MentorChat /></div>;
}
