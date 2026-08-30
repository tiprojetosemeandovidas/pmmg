import type { Metadata } from "next";
import Link from "next/link";
import { OperationsDashboard } from "@/components/operations-dashboard";

export const metadata: Metadata = { title: "Operação do piloto" };

export default function OperationsPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">CENTRAL OPERACIONAL</p><h1>Saúde do piloto.</h1><p>Erros, consumo, latência e fila de revisão sem expor conteúdo privado.</p></div><div className="button-row"><Link className="secondary-button link-button" href="/app/admin/piloto">Coorte ENEM</Link><Link className="secondary-button link-button" href="/app/admin/questoes">Banco de questões</Link><Link className="secondary-button link-button" href="/app/admin/editais">Revisar editais →</Link></div></header><OperationsDashboard /></div>;
}
