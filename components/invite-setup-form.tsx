"use client";

import { useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";

export function InviteSetupForm({ next }: { next: string }) {
  const router = useRouter();
  const { user, status } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setMessage("Abra novamente o link mais recente recebido por e-mail."); return; }
    if (password.length < 8) { setMessage("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirmation) { setMessage("As senhas não coincidem."); return; }
    const supabase = createClient();
    if (!supabase) { setMessage("Serviço de autenticação indisponível."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({
      password,
      data: { ...user.user_metadata, full_name: name.trim() },
    });
    setBusy(false);
    if (error) { setMessage("Não foi possível definir a senha. Solicite um novo convite."); return; }
    router.replace(next as Route);
  }

  return <main className="auth-page"><section className="auth-panel"><Brand /><div className="auth-copy"><p className="eyebrow">CONVITE ACEITO</p><h1>Finalize seu acesso</h1><p>Defina seu nome e uma senha para entrar novamente depois do primeiro acesso.</p></div>{status === "loading" ? <p className="auth-message">Validando seu convite…</p> : status !== "authenticated" ? <p className="auth-message error">Este convite não está ativo. Abra o link mais recente recebido por e-mail.</p> : <form className="auth-form" onSubmit={submit}><label>Nome completo<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label><label>Confirme a senha<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} /></label>{message && <p className="auth-message error" role="status">{message}</p>}<button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Salvando…" : "Entrar e começar →"}</button></form>}</section><aside className="auth-benefits"><p className="eyebrow">PILOTO ENEM</p><h2>Sua rota começa com evidências.</h2><ul><li>Diagnóstico inicial com questões validadas</li><li>Plano adaptado à sua disponibilidade</li><li>Revisões geradas pelos seus erros</li><li>Progresso sincronizado com segurança</li></ul></aside></main>;
}
