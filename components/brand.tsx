import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Rota — página inicial">
      <span className="brand-mark" aria-hidden="true">R</span>
      <span><b>Rota</b></span>
    </Link>
  );
}
