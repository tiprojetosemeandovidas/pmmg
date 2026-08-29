import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: "Área do candidato" };

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
