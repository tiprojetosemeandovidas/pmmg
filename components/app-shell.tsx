"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { useRota } from "@/components/providers/rota-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { NotificationCenter } from "@/components/notification-center";

const navigation = [
  ["/app", "⌂", "Início"],
  ["/app/plano", "▤", "Meu plano"],
  ["/app/desempenho", "⌁", "Desempenho"],
  ["/app/radar", "⌖", "Rota Score"],
  ["/app/oportunidades", "◎", "Oportunidades"],
  ["/app/mentor", "✦", "Mentor IA"],
  ["/app/questoes", "?", "Questões"],
  ["/app/revisoes", "↻", "Revisões"],
  ["/app/simulados", "◉", "Simulados"],
  ["/app/piloto", "✎", "Feedback piloto"],
  ["/app/taf", "⚑", "TAF"],
  ["/app/editais", "◇", "Editais"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { state, syncStatus } = useRota();
  const { user, signOut } = useAuth();
  const tafApplicable = /pmmg|police/i.test(state.profile.career);
  const completed = state.plan.filter((task) => task.status === "completed").length;
  const progress = state.plan.length ? Math.round((completed / state.plan.length) * 100) : 0;
  const initials = state.profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const syncLabel = user
    ? syncStatus === "synced" ? "Sincronizado" : syncStatus === "saving" ? "Salvando…" : syncStatus === "error" ? "Sincronização pendente" : "Conectando…"
    : "Modo demonstração";

  async function leave() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="app-shell next-app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Brand />
        <nav className="main-nav" aria-label="Navegação principal">
          {navigation.filter(([href]) => (href !== "/app/taf" || tafApplicable) && (href !== "/app/piloto" || state.profile.career === "enem-2026")).map(([href, icon, label]) => (
            <Link key={href} className={`nav-item ${pathname === href ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="mini-progress"><div className="mini-title"><span>Meta semanal</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{completed} de {state.plan.length} sessões</small></div>
          <Link className={`nav-item ${pathname === "/app/ajuda" ? "active" : ""}`} href="/app/ajuda"><span className="nav-icon">i</span><span>Ajuda e suporte</span></Link>
          <div className="profile"><span className="avatar">{initials || "C"}</span><span><b>{state.profile.name}</b><small>{user?.email ?? state.profile.careerLabel}</small></span></div>
          {user ? <button className="account-action" type="button" onClick={leave}>Sair da conta</button> : <Link className="account-action" href="/entrar">Entrar para sincronizar</Link>}
        </div>
      </aside>
      <main className="next-app-main">
        <header className="topbar"><button className="menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu">☰</button><div className="mobile-brand"><b>Rota</b></div><div className="top-actions"><span className={`sync-chip ${syncStatus}`}><i />{syncLabel}</span><span className="pilot-chip"><i />Piloto ENEM</span><NotificationCenter enabled={Boolean(user)} /></div></header>
        {children}
      </main>
    </div>
  );
}
