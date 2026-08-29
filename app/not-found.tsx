import Link from "next/link";

export default function NotFound() {
  return <main className="error-boundary"><div><span>404</span><p className="eyebrow">CAMINHO NÃO ENCONTRADO</p><h1>Esta rota não existe.</h1><p>Volte à sua área para continuar de onde parou.</p><Link className="primary-button link-button" href="/app">Ir para o início</Link></div></main>;
}
