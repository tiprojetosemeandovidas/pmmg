"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/auth/redirect";

type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };
type AccountRole = "candidate" | "reviewer" | "admin";

type AuthContextValue = {
  user: User | null;
  accountRole: AccountRole | null;
  status: "loading" | "authenticated" | "anonymous" | "unavailable";
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string, next?: string) => Promise<AuthResult>;
  resendConfirmation: (email: string, next?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered|already been registered/i.test(message)) return "Este e-mail já possui uma conta.";
  if (/password should be at least/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/rate limit|only request this after/i.test(message)) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível concluir agora. Tente novamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [accountRole, setAccountRole] = useState<AccountRole | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>(supabase ? "loading" : "unavailable");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setAccountRole(null);
      setUser(data.user);
      setStatus(data.user ? "authenticated" : "anonymous");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountRole(null);
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    if (!supabase || !user) return () => { active = false; };
    void supabase
      .from("profiles")
      .select("account_role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const role = data?.account_role;
        setAccountRole(role === "admin" || role === "reviewer" ? role : "candidate");
      });
    return () => { active = false; };
  }, [supabase, user]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "A conexão com o Supabase não está configurada." };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { ok: false, message: friendlyMessage(error.message) } : { ok: true };
    } catch {
      return { ok: false, message: "Não foi possível conectar ao serviço de autenticação." };
    }
  }, [supabase]);

  const signUp = useCallback(async (name: string, email: string, password: string, next?: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "A conexão com o Supabase não está configurada." };
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: authCallbackUrl(window.location.origin, next),
        },
      });
      if (error) return { ok: false, message: friendlyMessage(error.message) };
      return { ok: true, needsConfirmation: !data.session };
    } catch {
      return { ok: false, message: "Não foi possível conectar ao serviço de autenticação." };
    }
  }, [supabase]);

  const resendConfirmation = useCallback(async (email: string, next?: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "A conexão com o Supabase não está configurada." };
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authCallbackUrl(window.location.origin, next) },
      });
      return error ? { ok: false, message: friendlyMessage(error.message) } : { ok: true };
    } catch {
      return { ok: false, message: "Não foi possível conectar ao serviço de autenticação." };
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo(
    () => ({ user, accountRole, status, signIn, signUp, resendConfirmation, signOut }),
    [user, accountRole, status, signIn, signUp, resendConfirmation, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
