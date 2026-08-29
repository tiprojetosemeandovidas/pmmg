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

type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };

type AuthContextValue = {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous" | "unavailable";
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered|already been registered/i.test(message)) return "Este e-mail já possui uma conta.";
  if (/password should be at least/i.test(message)) return "A senha precisa ter pelo menos 8 caracteres.";
  if (/rate limit/i.test(message)) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Não foi possível concluir agora. Tente novamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>(supabase ? "loading" : "unavailable");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setStatus(data.user ? "authenticated" : "anonymous");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "A conexão com o Supabase não está configurada." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: friendlyMessage(error.message) } : { ok: true };
  }, [supabase]);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: "A conexão com o Supabase não está configurada." };
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=/app?onboarding=1`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo },
    });
    if (error) return { ok: false, message: friendlyMessage(error.message) };
    return { ok: true, needsConfirmation: !data.session };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo(() => ({ user, status, signIn, signUp, signOut }), [user, status, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
