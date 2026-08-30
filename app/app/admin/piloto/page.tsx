import type { Metadata } from "next";
import Link from "next/link";
import { PilotCohortAdmin } from "@/components/pilot-cohort-admin";

export const metadata: Metadata = { title: "Coorte do piloto" };

export default function PilotAdminPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">PILOTO ENEM • 10 PESSOAS</p><h1>Coorte e acompanhamento</h1><p>Convites fechados, consentimento e avanço por participante.</p></div><div className="button-row"><Link className="secondary-button link-button" href="/app/admin/questoes">Questões</Link><Link className="secondary-button link-button" href="/app/admin/operacoes">Operação</Link></div></header><PilotCohortAdmin /></div>;
}
