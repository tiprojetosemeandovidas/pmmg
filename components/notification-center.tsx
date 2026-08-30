"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

type Alert = { id: string; level: "info" | "attention"; title: string; message: string; href: Route };

export function NotificationCenter({ enabled }: { enabled: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch("/api/notifications").then((response) => response.json()).then((payload: { data?: Alert[] }) => {
      if (active) setAlerts(payload.data ?? []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled]);

  if (!enabled) return null;
  return <details className="notification-center"><summary aria-label={`${alerts.length} alertas`}><span aria-hidden="true">♢</span>{alerts.length > 0 && <b>{alerts.length}</b>}</summary><div className="notification-popover"><header><strong>Seus alertas</strong><small>Atualizados pela sua rota</small></header>{alerts.length ? alerts.map((alert) => <Link href={alert.href} className={`notification-item ${alert.level}`} key={alert.id} onClick={() => { void fetch("/api/pilot/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType: "notification_opened", eventKey: `notification:${alert.id}:${new Date().toISOString().slice(0, 10)}`, metadata: { alertId: alert.id } }) }); }}><i /><span><b>{alert.title}</b><small>{alert.message}</small></span></Link>) : <p>Nenhuma pendência agora.</p>}</div></details>;
}
