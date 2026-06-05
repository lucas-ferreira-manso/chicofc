import React from 'react'

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface-primary)',
      borderRadius: 16, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start'
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>{emoji}</span>
      <div>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)', marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)', color: 'var(--color-fg-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
          {children}
        </p>
      </div>
    </div>
  )
}

export default function TermsContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 36 }}>⚽</span>
        <h2 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 'var(--font-size-20)', color: 'var(--color-fg-primary)', marginTop: 8 }}>
          Termos da Pelada
        </h2>
        <p style={{ fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)', color: 'var(--color-fg-secondary)', marginTop: 4 }}>
          Atualizado. Leia (ou finja que leu) antes de continuar.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <Section emoji="🔒" title="Segurança dos seus dados">
          {'Seu nome, e-mail, foto de perfil e histórico de presença ficam guardados com segurança no Firebase (Google). São usados exclusivamente dentro do app — ninguém de fora tem acesso.\n\nNão vendemos, não compartilhamos, não fazemos nada suspeito. Os seus dados têm mais proteção do que nossa zaga no segundo tempo.'}
        </Section>

        <Section emoji="💸" title="Pagamentos e Comprovantes">
          {'A partir de agora, ao clicar em "Já paguei", você precisará enviar o comprovante do PIX. Sem comprovante, sem confirmação. Simples assim.\n\nO comprovante fica armazenado com segurança e só o admin tem acesso. Não tente mandar print de outra coisa — a gente sabe quando é photoshop, seu espertão.'}
        </Section>

        <Section emoji="📸" title="Redes Sociais">
          {'Você autoriza o time a postar momentos de bola cheia e bola murcha nas redes sociais. Fez um golaço? O mundo vai saber. Deu um frango feio? Também. É o preço da fama.'}
        </Section>

        <Section emoji="🚗" title="A Regra do Carro">
          Comprou um carro acima de R$ 500 mil? Parabéns! Você nos deve <strong>1 mês de churrasco completo</strong>, com picanha, linguiça e sem racionamento. Cláusula irrevogável e juridicamente duvidosa.
        </Section>

        <Section emoji="🍺" title="Direitos dos Admins">
          Os admins merecem ao menos <strong>1 cerveja gelada ou 1 Coca</strong> após cada jogo. Eles organizam tudo, aguentam reclamação, escalam time e ainda aprovam comprovante. Um brinde é o mínimo.
        </Section>

        <Section emoji="⏰" title="Lei do Atraso">
          Chegou com mais de 15 minutos de atraso sem avisar? Você entra correndo, sem aquecimento e com a consciência pesada. O grupo vai notar o olhar de julgamento coletivo.
        </Section>

        <Section emoji="🤧" title="Política de Gripe">
          Apareceu gripado no jogo? Respeito pela coragem, mas o grupo vai manter distância estratégica e julgar em silêncio.
        </Section>

        <Section emoji="🏆" title="Cláusula do Destaque">
          Ganhou o prêmio de melhor do jogo? Humildade é opcional, mas o grupo vai lembrar por semanas. Use o poder com responsabilidade.
        </Section>

        <Section emoji="✅" title="Ao aceitar, você confirma que">
          {'• Leu esses termos (ou scrollou rápido — vale)\n• É uma boa pessoa\n• Vai aparecer nos jogos que confirmou\n• Não vai sumir sem dar satisfação\n• Vai mandar o comprovante real ao pagar\n• Entende que seus dados estão seguros e bem guardados'}
        </Section>

      </div>
    </div>
  )
}
