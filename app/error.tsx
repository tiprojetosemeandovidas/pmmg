"use client";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-boundary"><div><span>!</span><p className="eyebrow">ALGO SAIU DA ROTA</p><h1>Não conseguimos concluir esta etapa.</h1><p>Se o problema continuar, informe o código <b>{error.digest ?? "sem-código"}</b> ao suporte.</p><button className="primary-button" type="button" onClick={reset}>Tentar novamente</button></div></main>;
}
