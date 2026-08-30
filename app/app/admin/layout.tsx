export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // O conteúdo sensível e todas as mutações são autorizados nas APIs. Manter
  // este layout sem redirecionamento evita ciclos durante a hidratação da sessão.
  return children;
}
