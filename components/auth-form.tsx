"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { useAuth } from "@/components/providers/auth-provider";

type ConfirmationError = "expired" | "invalid" | null;

export function AuthForm({ initialMode, next, confirmationError }: { initialMode: "login" | "signup"; next: Route; confirmationError: ConfirmationError }) {
  const router = useRouter();
  const { status, signIn, signUp, resendConfirmation } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    confirmationError === "expired"
      ? "O link de confirmação expirou. Digite seu e-mail abaixo para receber outro."
      : confirmationError === "invalid"
        ? "O link de confirmação é inválido ou já foi utilizado. Digite seu e-mail abaixo para receber outro."
        : "",
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [next, router, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const result = mode === "login" ? await signIn(email, password) : await signUp(name.trim(), email, password);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.needsConfirmation) {
      setSuccess(true);
      setMessage("Cadastro criado. Enviamos um link de confirmação para seu e-mail.");
      return;
    }
    router.replace(next);
  }

  async function resend() {
    if (!email.trim()) {
      setSuccess(false);
      setMessage("Digite o e-mail usado no cadastro para reenviar a confirmação.");
      return;
    }
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const result = await resendConfirmation(email.trim());
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSuccess(true);
    setMessage("Enviamos um novo link. Abra-o neste mesmo navegador para confirmar sua conta.");
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <p className="eyebrow">SUA JORNADA CONTINUA</p>
          <h1>{mode === "login" ? "Entre na sua Rota" : "Crie sua Rota"}</h1>
          <p>{mode === "login" ? "Seu plano, evolução e revisões ficam sincronizados." : "Comece pelo diagnóstico e receba um plano adaptado à sua rotina."}</p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => { setMode("login"); setMessage(""); }}>Entrar</button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Criar conta</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <label>Nome completo<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Senha<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
          {message && <p className={`auth-message ${success ? "success" : "error"}`} role="status">{message}</p>}
          {confirmationError && (
            <button className="auth-resend" type="button" onClick={resend} disabled={busy || status === "loading" || status === "unavailable"}>
              Reenviar link de confirmação
            </button>
          )}
          <button className="primary-button auth-submit" type="submit" disabled={busy || status === "loading" || status === "unavailable"}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar →" : "Criar minha conta →"}
          </button>
        </form>
        <div className="auth-demo"><span>Quer conhecer antes?</span><Link href="/app">Explorar modo demonstração</Link></div>
      </section>
      <aside className="auth-benefits">
        <p className="eyebrow">UMA CONTA, UMA ROTA VIVA</p>
        <h2>Seu estudo acompanha você.</h2>
        <ul><li>Plano recalculado após cada evidência</li><li>Progresso sincronizado entre dispositivos</li><li>Revisões e pontos fracos sempre disponíveis</li><li>Dados protegidos por políticas individuais</li></ul>
      </aside>
    </main>
  );
}
