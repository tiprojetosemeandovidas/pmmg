import type { Metadata } from "next";
import Link from "next/link";
import { NoticeReviewQueue } from "@/components/notice-review-queue";

export const metadata: Metadata = { title: "Revisão de editais" };

export default function NoticeReviewPage() {
  return <div className="next-content"><header className="page-header"><div><p className="eyebrow">OPERAÇÃO SEGURA</p><h1>Revisão de editais</h1><p>Nenhuma extração alimenta o plano antes desta validação humana.</p></div><div className="button-row"><Link className="secondary-button link-button" href="/app/admin/questoes">Banco de questões</Link><Link className="secondary-button link-button" href="/app/admin/operacoes">Ver operação →</Link></div></header><NoticeReviewQueue /></div>;
}
