"use client";

import {
  completeOnboarding as applyOnboarding,
  completeTask as applyTaskCompletion,
  completeWeeklyCheckin as applyWeeklyCheckin,
  createInitialState,
  getViewModel,
  recalculatePlan,
  recordAnswer as applyAnswer,
} from "@/lib/domain/adaptive-engine";
import type {
  OnboardingInput,
  QuestionEvidence,
  RotaState,
  RotaViewModel,
} from "@/lib/domain/rota";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "rota-adaptive-state-v3";
const storageKey = (userId?: string) => userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;

export type SyncStatus = "loading" | "local" | "saving" | "synced" | "error";

type RotaContextValue = {
  state: RotaState;
  view: RotaViewModel;
  hydrated: boolean;
  syncStatus: SyncStatus;
  completeOnboarding: (profile: OnboardingInput) => void;
  recordAnswer: (
    question: QuestionEvidence,
    selectedOption: number,
    context: "diagnostic" | "practice" | "simulation" | "review",
  ) => void;
  completeTask: (taskId: string) => void;
  completeWeeklyCheckin: () => void;
  recalculate: (reason?: string) => void;
  resetDemo: () => void;
};

const RotaContext = createContext<RotaContextValue | null>(null);

function initialState() {
  return recalculatePlan(
    createInitialState(),
    "Plano demonstrativo inicial criado.",
  );
}

function readStoredState(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as RotaState | null;
    return parsed?.version === 3 ? parsed : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function trackPilotEvent(eventType: string, eventKey: string, metadata: Record<string, string | number | boolean | null> = {}) {
  void fetch("/api/pilot/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType, eventKey, metadata, occurredAt: new Date().toISOString() }),
  });
}

export function RotaProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<RotaState>(initialState);
  const stateRef = useRef(state);
  const [localHydrated, setLocalHydrated] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const parsed = readStoredState(STORAGE_KEY);
    queueMicrotask(() => {
      if (parsed) setState(parsed);
      setLocalHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!localHydrated || authStatus === "loading") return;
    let active = true;

    const loadRemoteState = async () => {
      await Promise.resolve();
      if (!active) return;
      setSyncReady(false);
      if (!user || !supabase) {
        const localState = readStoredState(STORAGE_KEY);
        if (localState) setState(localState);
        else if (authStatus === "anonymous") setState(initialState());
        setSyncStatus("local");
        setSyncReady(true);
        return;
      }
      setSyncStatus("loading");
      const userLocalState = readStoredState(storageKey(user.id));
      const seed = userLocalState ?? stateRef.current;
      const { data, error } = await supabase
        .from("candidate_states")
        .select("state, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;

      if (error) {
        setState(seed);
        setSyncStatus("error");
        setSyncReady(true);
        return;
      }

      const remote = data?.state as RotaState | undefined;
      const validRemote = remote?.version === 3 ? remote : null;
      const chosen = validRemote && new Date(validRemote.updatedAt).getTime() >= new Date(seed.updatedAt).getTime()
        ? validRemote
        : seed;
      const accountName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const personalized = chosen.profile.name === "Candidato" && accountName
        ? { ...chosen, profile: { ...chosen.profile, name: accountName }, updatedAt: new Date().toISOString() }
        : chosen;
      setState(personalized);
      setSyncStatus("synced");
      setSyncReady(true);
    };
    void loadRemoteState();
    return () => { active = false; };
  }, [authStatus, localHydrated, supabase, user]);

  useEffect(() => {
    if (!localHydrated || !syncReady) return;
    localStorage.setItem(storageKey(user?.id), JSON.stringify(state));
    if (!user || !supabase) return;

    const timer = window.setTimeout(() => {
      setSyncStatus("saving");
      void supabase.from("candidate_states").upsert({
        user_id: user.id,
        state_version: state.version,
        state,
        updated_at: state.updatedAt,
      }).then(({ error }) => setSyncStatus(error ? "error" : "synced"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [localHydrated, state, supabase, syncReady, user]);

  const completeOnboarding = useCallback((profile: OnboardingInput) => {
    setState((current) => applyOnboarding(current, profile));
    if (user) {
      const key = `onboarding:${user.id}`;
      trackPilotEvent("onboarding_completed", key, { career: profile.career });
      trackPilotEvent("diagnostic_started", `diagnostic:${user.id}:${profile.career}`, { target: 10 });
    }
  }, [user]);

  const recordAnswer = useCallback(
    (
      question: QuestionEvidence,
      selectedOption: number,
      context: "diagnostic" | "practice" | "simulation" | "review",
    ) => {
      setState((current) =>
        applyAnswer(current, question, selectedOption, context),
      );
      if (user && state.diagnostic.active && context === "diagnostic" && state.diagnostic.answered + 1 >= state.diagnostic.target) {
        trackPilotEvent("diagnostic_completed", `diagnostic-completed:${user.id}:${state.diagnostic.target}`, { answered: state.diagnostic.target });
      }
    },
    [state.diagnostic, user],
  );

  const completeTask = useCallback((taskId: string) => {
    setState((current) => applyTaskCompletion(current, taskId));
    if (user) trackPilotEvent("task_completed", `task:${taskId}`, {});
  }, [user]);

  const completeWeeklyCheckin = useCallback(() => {
    setState((current) => applyWeeklyCheckin(current));
    if (user) trackPilotEvent("weekly_checkin_completed", `checkin:${new Date().toISOString().slice(0, 10)}`, {});
  }, [user]);

  const recalculate = useCallback((reason = "Rota recalculada manualmente.") => {
    setState((current) => recalculatePlan(current, reason));
  }, []);

  const resetDemo = useCallback(() => setState(initialState()), []);
  const view = useMemo(() => getViewModel(state), [state]);
  const hydrated = localHydrated && authStatus !== "loading" && syncReady;
  const value = useMemo(
    () => ({
      state,
      view,
      hydrated,
      syncStatus,
      completeOnboarding,
      recordAnswer,
      completeTask,
      completeWeeklyCheckin,
      recalculate,
      resetDemo,
    }),
    [
      state,
      view,
      hydrated,
      syncStatus,
      completeOnboarding,
      recordAnswer,
      completeTask,
      completeWeeklyCheckin,
      recalculate,
      resetDemo,
    ],
  );

  return <RotaContext.Provider value={value}>{children}</RotaContext.Provider>;
}

export function useRota() {
  const context = useContext(RotaContext);
  if (!context) throw new Error("useRota must be used inside RotaProvider");
  return context;
}
