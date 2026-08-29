import Link from "next/link";
import { Brand } from "@/components/brand";

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Navegação pública">
          <a href="#como-funciona">Recursos</a>
          <a href="#concursos">Concursos</a>
          <a href="#planos">Planos</a>
        </nav>
        <Link className="landing-login" href="/entrar">Entrar</Link>
      </header>

      <main className="landing-main">
        <section className="hero hero-clean">
          <div className="hero-copy">
            <span className="hero-badge">SEU SISTEMA OPERACIONAL DE APROVAÇÃO</span>
            <h1>Saiba o que estudar.<br /><em>Agora.</em></h1>
            <p>Escolha seu concurso ou envie o edital. A Rota mede seu nível, organiza sua semana e recalcula o caminho conforme você evolui.</p>
            <div className="hero-facts">
              <span><b>1.288</b> questões PMMG catalogadas</span>
              <span><b>32</b> provas históricas</span>
              <span><b>1 rota</b> que aprende com você</span>
            </div>
            <Link className="discover-button" href="/entrar?mode=signup&next=/app?onboarding=1">Descobrir minha rota <span>→</span></Link>
          </div>
          <div className="access-card">
            <span className="access-kicker">ÁREA DO CANDIDATO</span>
            <h2>Sua próxima ação, sem achismo</h2>
            <p>Entre para ver seu plano, responder questões e acompanhar domínio e confiança por tópico.</p>
            <Link className="access-primary" href="/app">Entrar na plataforma</Link>
            <div className="access-divider"><i /><span>ou</span><i /></div>
            <Link className="access-secondary" href="/entrar?mode=signup&next=/app?onboarding=1">Montar meu plano grátis</Link>
            <small>Diagnóstico gratuito. Sem promessa de aprovação.</small>
            <div className="access-preview"><span className="preview-dot" /><div><b>Motor explicável</b><small>Edital, domínio, recência e tempo disponível</small></div></div>
          </div>
        </section>

        <section className="trust-strip">
          <span>Uma plataforma. Muitos caminhos.</span>
          <div><b>PMMG</b><small>primeira vertical validada</small></div>
          <div><b>Pré e pós-edital</b><small>cadência em qualquer fase</small></div>
          <div><b>Intelectual + TAF</b><small>quando o concurso exigir</small></div>
        </section>

        <section className="landing-section" id="como-funciona">
          <p className="eyebrow">SUA ROTA PERSONALIZADA</p>
          <h2>Não é só estudar mais.<br />É saber o que estudar agora.</h2>
          <div className="benefit-grid">
            <article><span>01</span><i>⌖</i><h3>Diagnóstico rápido</h3><p>Estimamos domínio e confiança sem depender de questões aleatórias.</p></article>
            <article><span>02</span><i>✓</i><h3>Decisão diária</h3><p>Priorizamos o conteúdo que oferece maior ganho esperado naquele momento.</p></article>
            <article><span>03</span><i>↗</i><h3>Plano resiliente</h3><p>A semana se reorganiza conforme você estuda, erra, acerta ou perde um dia.</p></article>
          </div>
        </section>

        <section className="career-section" id="concursos">
          <div><p className="eyebrow">CONHECIMENTO QUE VIAJA COM VOCÊ</p><h2>Seu domínio pertence a você.</h2><p>O que você aprende em um concurso é reaproveitado em todos os editais que cobram os mesmos tópicos.</p></div>
          <div className="career-cards">
            <article><span>CALENDÁRIO CONFIRMADO</span><h3>ENEM 2026</h3><p>8 e 15 de novembro • quatro áreas e redação</p><b>Trilha disponível →</b></article>
            <article><span>VERTICAL DISPONÍVEL</span><h3>PMMG</h3><p>CFSD e CFO • acervo histórico catalogado</p><b>Explorar rota →</b></article>
            <article><span>ARQUITETURA NACIONAL</span><h3>Policiais</h3><p>PF, PRF, polícias civis e militares</p><b>Em preparação</b></article>
            <article><span>ARQUITETURA NACIONAL</span><h3>Fiscal e tribunais</h3><p>Conteúdo compartilhado e metas específicas</p><b>Em preparação</b></article>
          </div>
        </section>

        <section className="pricing" id="planos">
          <p className="eyebrow">COMECE AGORA</p>
          <h2>Valide sua primeira rota.</h2>
          <div className="price-card"><div><span>ROTA ESSENCIAL</span><h3>Diagnóstico gratuito</h3><p>Onboarding, plano adaptativo, questões, revisão e Rota Score.</p></div><Link className="hero-cta" href="/entrar?mode=signup&next=/app?onboarding=1">Criar minha rota →</Link></div>
        </section>
      </main>
      <footer className="landing-footer"><span>Rota — preparação adaptativa para concursos.</span><span>Conteúdo identificado • Seus dados protegidos</span></footer>
    </div>
  );
}
