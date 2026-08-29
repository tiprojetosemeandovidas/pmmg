import type { Metadata } from "next";
import { headers } from "next/headers";
import { RotaProvider } from "@/components/providers/rota-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Rota — Seu sistema operacional de aprovação";
  const description = "Preparação adaptativa para concursos públicos com diagnóstico, plano autoajustável e recomendações explicáveis.";
  return {
    metadataBase,
    title: { default: title, template: "%s | Rota" },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: new URL("/og.png", metadataBase).toString(), width: 1731, height: 909, alt: "Rota — Saiba o que estudar. Agora." }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <RotaProvider>{children}</RotaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
