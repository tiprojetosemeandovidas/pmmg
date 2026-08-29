"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRota } from "@/components/providers/rota-provider";
import { calculateGamification } from "@/lib/domain/gamification-engine";
import type { GamificationSnapshot } from "@/lib/progress/types";

export function GamificationPanel() {
  const { state } = useRota();
  const { user } = useAuth();
  const local = useMemo(() => calculateGamification(state), [state]);
  const [snapshot, setSnapshot] = useState<GamificationSnapshot | null>(null);
  const current = snapshot ?? local;

  useEffect(() => {
    if (!user) return;
    void fetch("/api/gamification/evaluate", { method: "POST" }).then(async (response) => {
      if (response.ok) setSnapshot(await response.json());
    });
  }, [state.updatedAt, user]);

  return <section className="gamification-panel"><div className="panel-head"><div><p className="eyebrow">MISSÕES SAUDÁVEIS</p><h3>Consistência que vira conquista</h3><p>O progresso é limitado à meta planejada; estudar além dela não multiplica recompensas.</p></div><span>{current.completedMissions}/{current.missions.length} missões</span></div><div className="mission-list">{current.missions.map((mission) => <article key={mission.code}><div><b>{mission.title}</b><small>{mission.description}</small></div><strong>{mission.progress}/{mission.target}</strong><i><span style={{ width: `${Math.min(100, mission.progress / mission.target * 100)}%` }} /></i><em>{mission.completed ? "Concluída" : `+${mission.xp} XP ao concluir`}</em></article>)}</div><div className="achievement-strip">{current.achievements.map((achievement) => <span className={achievement.earned ? "earned" : ""} title={achievement.description} key={achievement.code}><i>{achievement.icon}</i><b>{achievement.title}</b></span>)}</div></section>;
}
