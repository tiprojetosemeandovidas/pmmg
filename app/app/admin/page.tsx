import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Administração" };

const areas = [
  { href: "/app/admin/piloto", eyebrow: "PILOTO ENEM", title: "Coorte e participantes", description: "Crie a turma fechada, convide as 10 pessoas e acompanhe consentimento, atividade e feedback." },
  { href: "/app/admin/questoes", eyebrow: "CONTEÚDO", title: "Banco de questões", description: "Prepare questões autorais, registre fontes e faça a revisão humana antes da publicação." },
  { href: "/app/admin/editais", eyebrow: "CURADORIA", title: "Revisão de editais", description: "Valide extrações e impeça que conteúdo não revisado altere os planos dos candidatos." },
  { href: "/app/admin/operacoes", eyebrow: "OBSERVABILIDADE", title: "Operação do piloto", description: "Acompanhe o funil de uso, erros, latência, consumo e filas operacionais." },
] as const;

export default function AdminPage() {
  return (
    <div className="next-content">
      <header className="page-header"><div><p className="eyebrow">ACESSO RESTRITO</p><h1>Administração</h1><p>Controle o piloto ENEM, o conteúdo e a saúde da operação em um só lugar.</p></div></header>
      <div className="admin-hub-grid">
        {areas.map((area) => (
          <Link className="surface admin-hub-card" href={area.href} key={area.href}>
            <span>{area.eyebrow}</span><h2>{area.title}</h2><p>{area.description}</p><b>Acessar →</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
