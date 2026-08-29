"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}><div style={{ textAlign: "center", maxWidth: 520 }}><h1>A aplicação encontrou um erro inesperado.</h1><p>Seus dados permanecem preservados. Tente carregar novamente.</p><button type="button" onClick={reset}>Tentar novamente</button></div></main></body></html>;
}
