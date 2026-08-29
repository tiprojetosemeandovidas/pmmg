import type { Metadata } from "next";
import Link from "next/link";
import { QuestionBankAdmin } from "@/components/question-bank-admin";

export const metadata: Metadata = { title: "Banco de questões" };

export default function QuestionBankPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">CENTRAL DE CONHECIMENTO</p><h1>Banco de questões</h1><p>Pesquisa web e cadastro manual, com origem rastreável e validação humana.</p></div><div className="button-row"><Link className="secondary-button link-button" href="/app/admin/editais">Editais</Link><Link className="secondary-button link-button" href="/app/admin/operacoes">Operação</Link></div></header><QuestionBankAdmin /></div>;
}
