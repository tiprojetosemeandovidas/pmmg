import type { Metadata } from "next";
import { PhysicalTracker } from "@/components/physical-tracker";

export const metadata: Metadata = { title: "Preparação física" };

export default function TafPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">PREPARAÇÃO FÍSICA</p><h1>TAF: evolução sem achismo.</h1><p>Metas pessoais, medições históricas e requisitos oficiais claramente separados.</p></div></header><PhysicalTracker /></div>;
}
