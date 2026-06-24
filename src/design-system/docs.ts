export interface DocEntry {
  description: string
  usage?: string[]
  variants?: { name: string; description: string }[]
  behaviors?: string[]
  doList?: string[]
  dontList?: string[]
}

export const DOCS: Record<string, DocEntry> = {

  // ── Foundations ────────────────────────────────────────────────────────────

  'colors-surface': {
    description: 'Cores de fundo usadas em toda a hierarquia visual do app. Cada nível representa uma elevação diferente — do fundo da tela até elementos sobrepostos como cards e inputs.',
    variants: [
      { name: '--color-bg',                    description: 'Fundo base da tela. Toda página começa com essa cor.' },
      { name: '--color-surface-primary',       description: 'Cards, listas e containers de primeiro nível. Usado em list items, stat cards e seções.' },
      { name: '--color-surface-secondary',     description: 'Inputs, tabs inativas e elementos de fundo de menor destaque.' },
      { name: '--color-surface-accent',        description: 'Botões primários, barras ativas, destaques da marca. Azul ChicoFC.' },
      { name: '--color-surface-accent-light',  description: 'Versão suave do accent, usada em info cards e fundos de destaque sem peso.' },
      { name: '--color-surface-accent-yellow', description: 'Cor do time amarelo. Usada em contextos do time ou destaque secundário.' },
      { name: '--color-surface-quaternary',    description: 'Azul claro. Fundo de avatares e elementos de perfil.' },
      { name: '--color-surface-gold',          description: 'Medalha de 1º lugar no ranking de presença e votação.' },
      { name: '--color-surface-silver',        description: 'Medalha de 2º lugar no ranking.' },
      { name: '--color-surface-bronze',        description: 'Medalha de 3º lugar no ranking.' },
    ],
    doList: [
      'Use --color-bg como fundo da tela e --color-surface-primary para cards sobre ela.',
      'Respeite a hierarquia de superfície — nunca use uma cor mais clara em cima de uma mais escura.',
      'Use accent apenas em elementos de ação ou destaque de marca.',
    ],
    dontList: [
      'Não use accent como fundo de tela inteira — é reservado para botões e ícones.',
      'Não misture gold/silver/bronze fora do contexto de ranking.',
    ],
  },

  'colors-foreground': {
    description: 'Cores de texto e ícones. Definidas em três camadas de hierarquia: primário para conteúdo principal, secundário para metadados e terciário para texto sobre fundos escuros.',
    variants: [
      { name: '--color-fg-primary',       description: 'Texto principal. Nomes, títulos, valores importantes.' },
      { name: '--color-fg-secondary',     description: 'Metadados, labels, datas, subtítulos. Sempre com menos peso visual.' },
      { name: '--color-fg-tertiary',      description: 'Texto sobre fundos escuros (stadium card, bottom sheet dark). Sempre branco.' },
      { name: '--color-fg-accent',        description: 'Links, valores em destaque, aba ativa. Azul ChicoFC.' },
      { name: '--color-fg-accent-yellow', description: 'Texto de destaque do time amarelo ou ação secundária amarela.' },
    ],
    doList: [
      'Use fg-primary para toda informação que o usuário precisa ler primeiro.',
      'Use fg-secondary para datas, contagens e contexto de apoio.',
      'Use fg-tertiary quando o fundo for escuro (imagem, overlay, card stadium).',
    ],
    dontList: [
      'Não use fg-primary sobre fundos escuros — ele desaparece.',
      'Não use fg-accent para texto de corpo longo — reservado para destaques pontuais.',
    ],
  },

  'colors-semantic': {
    description: 'Cores com significado funcional. Usadas para estados de feedback e separadores visuais.',
    variants: [
      { name: '--color-border',  description: 'Bordas de containers, separadores e inputs sem foco. Sempre sutil.' },
      { name: '--color-success', description: 'Confirmações, pagamentos confirmados, presença marcada.' },
      { name: '--color-warning', description: 'Alertas não bloqueantes, prazos próximos.' },
      { name: '--color-danger',  description: 'Erros, Bola Murcha, ações destrutivas (excluir, remover).' },
    ],
  },

  'colors-button': {
    description: 'Tokens dedicados aos botões. Separados das cores gerais para permitir ajuste independente por tema — especialmente no dark mode onde o botão primário inverte.',
    variants: [
      { name: '--btn-primary-bg', description: 'Fundo do botão primário. Azul no light, branco no dark.' },
      { name: '--btn-primary-fg', description: 'Texto do botão primário. Branco no light, preto no dark.' },
      { name: '--btn-secondary-bg', description: 'Fundo suave para botões secundários, não compete com o primário.' },
      { name: '--btn-secondary-fg', description: 'Texto do botão secundário, mantém a cor accent.' },
    ],
  },

  'colors-special': {
    description: 'Tokens para contextos específicos do app: avatares, números de ranking e banners informativos.',
    variants: [
      { name: '--color-avatar-bg', description: 'Fundo de avatares sem foto. Azul claro consistente com a marca.' },
      { name: '--color-avatar-fg', description: 'Iniciais dentro do avatar. Azul escuro sobre fundo claro.' },
      { name: '--color-info-bg',   description: 'Fundo de banners informativos. Versão muito suave do accent.' },
      { name: '--color-info-fg',   description: 'Texto em banners informativos.' },
      { name: '--color-number-bg', description: 'Fundo de badges numéricos (contagem de jogos, gols).' },
      { name: '--color-number-fg', description: 'Texto dentro dos badges numéricos.' },
    ],
  },

  typography: {
    description: 'O app usa exclusivamente Poppins em todos os textos. A escala tem 7 tamanhos fixos que cobrem desde labels mínimos até displays de placar. Cada tamanho pode ser combinado com os pesos disponíveis: 400 (Regular), 500 (Medium), 600 (SemiBold) e 700 (Bold).',
    variants: [
      { name: 'Size 11',           description: 'Menor tamanho permitido. Usado em timestamps, badges de contagem e labels de tab na nav.' },
      { name: 'Size 12',           description: 'Captions, subtítulos de cards pequenos e labels de categoria em caps.' },
      { name: 'Size 14',           description: 'Nome de atleta em badges, texto de suporte, descrições em bottom sheets.' },
      { name: 'Size 16 — Body',    description: 'Tamanho padrão de corpo de texto. Botões, inputs, list items e a maioria dos textos interativos.' },
      { name: 'Size 18',           description: 'Label principal de badges de votação (Bola Cheia / Bola Murcha).' },
      { name: 'Size 24 — Title',   description: 'Títulos de seção, nome da página no Header, chamadas de card grande.' },
      { name: 'Size 32 — Display', description: 'Placar de jogo e contadores grandes. Máximo da escala.' },
    ],
    behaviors: [
      'Nunca use tamanho abaixo de 11px — ilegível em telas pequenas.',
      'Títulos de Header sempre são 24px SemiBold (600).',
      'Botões sempre 16px Medium (500).',
      'Labels de nav sempre 12px SemiBold (600).',
    ],
  },

  spacing: {
    description: 'Escala de espaçamento com 4 valores. Usada em padding, gap e margin. Todos derivados de múltiplos de 8 para manter consistência em toda a grade.',
    variants: [
      { name: '--space-8',  description: 'Espaçamento mínimo. Gap entre ícone e texto, padding de badges e chips.' },
      { name: '--space-16', description: 'Padding interno de list items, gap entre elementos de um card.' },
      { name: '--space-24', description: 'Padding de cards e seções, espaço entre grupos de conteúdo.' },
      { name: '--space-40', description: 'Espaçamento entre seções maiores, padding vertical de páginas.' },
    ],
    doList: [
      'Use --space-16 como padding padrão de list items (já aplicado em todos os itens do app).',
      'Use --space-24 para padding de cards e entre seções da página.',
      'Mantenha gap entre elementos de uma lista sempre em 8px.',
    ],
  },

  'border-radius': {
    description: 'Três valores de arredondamento que definem a linguagem visual do app. Todos os elementos seguem esse vocabulário — nunca use valores arbitrários.',
    variants: [
      { name: '--radius-tag',  description: '16px. Chips, tags de status, badges inline e o controle de Tabs.' },
      { name: '--radius-card', description: '24px. Todos os cards, list items, bottom sheets e containers maiores.' },
      { name: '--radius-pill', description: '99999px. Exclusivo para botões de ação, toggles e avatares circulares.' },
    ],
    doList: [
      'Cards sempre usam --radius-card (24px) — nunca 16px ou 12px.',
      'Botões primários e secundários sempre usam --radius-pill.',
      'Tags e chips de status sempre usam --radius-tag (16px).',
    ],
    dontList: [
      'Não crie raios arbitrários como 8px, 12px ou 20px.',
      'Não use pill em cards — apenas em elementos de ação.',
    ],
  },

  // ── Components ─────────────────────────────────────────────────────────────

  buttons: {
    description: 'Botões são os principais elementos de ação do app. Seguem um sistema de 4 variantes com papéis bem definidos. Sempre usam --radius-pill e height fixo de 48px ou 56px (ações principais de confirmação).',
    variants: [
      { name: 'Primary',   description: 'Ação principal da tela ou fluxo. Só deve haver um por seção. Ex.: Confirmar votos, Salvar, Entrar.' },
      { name: 'Secondary', description: 'Ação alternativa ou de menor peso. Ex.: Cancelar, Ver todos, compartilhar.' },
      { name: 'Danger',    description: 'Ações destrutivas ou irreversíveis. Ex.: Remover jogo, Excluir jogador.' },
      { name: 'Disabled',  description: 'Quando a ação não está disponível. O botão mantém sua forma mas com opacity 0.4–0.6.' },
    ],
    behaviors: [
      'Height 48px para botões secundários e de navegação.',
      'Height 56px para o CTA principal de um bottom sheet ou formulário.',
      'O botão primário inverte no dark mode (fundo branco, texto escuro).',
      'Sempre usar active:scale-95 para feedback tátil ao toque.',
      'Estado de loading: substituir label por "Salvando..." e disabled=true.',
    ],
    doList: [
      'Uma ação primária por contexto. Se houver duas ações igualmente importantes, use Primary + Secondary.',
      'Sempre informe o estado de loading com texto descritivo.',
    ],
    dontList: [
      'Não use dois botões Primary lado a lado.',
      'Não use botões icon-only sem aria-label.',
    ],
  },

  header: {
    description: 'Barra fixa no topo da tela com título da página e espaço para ação contextual à direita. Sempre com borda inferior sutil e fundo que segue --color-bg (transparente em dark mode com blur).',
    variants: [
      { name: 'Default',   description: 'Título + subtítulo opcional (ex.: data do jogo ou última atualização).' },
      { name: 'Com ação',  description: 'Título + elemento à direita (botão, chip, ícone). Ex.: Modo Chinelinho na tela de Jogadores.' },
    ],
    behaviors: [
      'Sempre position: fixed, top: 0, z-index: 40.',
      'O conteúdo da página deve ter padding-top de 96px para não ficar sob o header.',
      'Título sempre 24px SemiBold. Subtítulo sempre 16px Medium em --color-fg-secondary.',
      'O rightContent aceita qualquer ReactNode — chip, ícone, texto.',
    ],
  },

  'bottom-nav': {
    description: 'Navegação principal do app fixada na base da tela. Sempre visível exceto em telas que exigem foco total (escalação, admin de notificações). Cada tab tem ícone + label.',
    variants: [
      { name: 'Tab ativa',   description: 'Ícone preenchido (weight fill) + label em --color-fg-accent-light.' },
      { name: 'Tab inativa', description: 'Ícone outline + label em --color-fg-secondary.' },
      { name: 'Tab Perfil',  description: 'Avatar circular com foto ou iniciais. Anel de destaque quando ativa.' },
    ],
    behaviors: [
      'Height total 80px (--bottom-nav-height), respeitando safe-area-inset-bottom em iOS.',
      'O conteúdo da página deve ter padding-bottom suficiente para não esconder por baixo da nav.',
      'Máximo de 5 tabs. Tabs admin só aparecem para usuários com role=admin.',
      'Transição suave de cor ao mudar de tab (transition: color 0.15s).',
    ],
  },

  tabs: {
    description: 'Controle de abas inline (Segmented Control). Usado para alternar entre visualizações dentro da mesma tela, sem navegação. Sempre dentro de um container com --color-surface-secondary.',
    variants: [
      { name: 'Aba ativa',   description: 'Fundo branco + box-shadow sutil. Texto em --color-fg-primary.' },
      { name: 'Aba inativa', description: 'Fundo transparente. Texto em --color-fg-primary com menor peso visual.' },
    ],
    behaviors: [
      'Container: background --color-surface-secondary, border-radius 20px, padding 8px.',
      'Cada tab: border-radius 16px, padding 8px 12px, font-size 16px Medium.',
      'A troca de aba é sempre instantânea — sem animação de slide de conteúdo.',
      'A aba ativa é persistida na URL via query param (?tab=jogador) para deep link.',
    ],
    doList: [
      'Use tabs para conteúdo da mesma hierarquia dentro de uma tela.',
      'Máximo de 3 tabs por controle — mais que isso vira nav.',
    ],
    dontList: [
      'Não use tabs para navegar entre telas diferentes — use o Bottom Nav.',
      'Não misture tabs com Bottom Nav na mesma hierarquia.',
    ],
  },

  toggle: {
    description: 'Switch on/off para preferências e configurações binárias. Sempre acompanhado de um label à esquerda descrevendo o que está sendo ativado.',
    variants: [
      { name: 'On (ativo)',   description: 'Fundo --color-surface-quaternary (azul claro). Thumb à direita.' },
      { name: 'Off (inativo)', description: 'Fundo --color-surface-secondary (cinza). Thumb à esquerda.' },
      { name: 'Disabled',    description: 'Opacity 0.5, cursor not-allowed. Não responde a cliques.' },
    ],
    behaviors: [
      'Dimensões fixas: 68px × 36px. Thumb: 30px × 30px.',
      'Transição suave de posição e cor (0.25s) para feedback visual claro.',
      'Sempre usar role="switch" e aria-checked para acessibilidade.',
      'Sem label dentro do toggle — o texto fica sempre à esquerda.',
    ],
  },

  avatar: {
    description: 'Representação visual de um jogador. Exibe foto de perfil quando disponível ou iniciais (2 letras) quando não há foto. A cor de fundo e do texto é consistente em todo o app.',
    variants: [
      { name: '24px — Nav',         description: 'Tab de Perfil no Bottom Nav.' },
      { name: '32px — List',        description: 'Ao lado do nome em list items e bottom sheets de seleção.' },
      { name: '48px — Sheet',       description: 'Cabeçalho de bottom sheets de detalhe.' },
      { name: '64px — Perfil',      description: 'Tela de perfil e cards de resultado.' },
      { name: '96px — Sheet Detail', description: 'Detalhe de jogador no bottom sheet de stats.' },
    ],
    behaviors: [
      'Sempre circular (border-radius: 50%).',
      'Fundo: --color-avatar-bg. Texto de iniciais: --color-avatar-fg.',
      'Com foto: objectFit cover centrado no rosto (objectPosition: center top).',
      'Iniciais sempre em uppercase, máximo 2 caracteres (primeiro e último nome).',
      'Anel de destaque (outline) quando ativo na navegação.',
    ],
  },

  cards: {
    description: 'Containers de conteúdo. O app usa quatro tipos principais, cada um com propósito específico. Todos compartilham o mesmo --radius-card (24px).',
    variants: [
      { name: 'Surface Card',   description: 'Container genérico. Fundo --color-surface-primary. Para qualquer grupo de informação.' },
      { name: 'Info Card',      description: 'Banners informativos e de destaque. Fundo --color-info-bg com ícone e texto accent.' },
      { name: 'Stat Card',      description: 'Grid de métricas do jogador. Número grande + label. Sempre em grid 2×2.' },
      { name: 'Score Card',     description: 'Placar do jogo. Times com escudos, números 32px. Fundo --color-surface-primary.' },
      { name: 'Stadium Card',   description: 'Card de votação com imagem de fundo do estádio + overlay escuro (rgba 0,0,0,0.35).' },
    ],
    behaviors: [
      'Todos usam border-radius: 24px (--radius-card).',
      'Surface Card e Stat Card usam --color-surface-primary como fundo.',
      'Stadium Card sempre tem overlay de 35% de opacidade sobre a imagem.',
      'Cards nunca têm sombra — a elevação é indicada pela diferença de cor de fundo.',
    ],
    doList: [
      'Use Surface Card como container padrão quando não houver tipo específico.',
      'Info Card deve ter sempre ícone + título + subtítulo.',
    ],
    dontList: [
      'Não use sombra em nenhum card — o design é flat.',
      'Não misture tipos de card dentro de um mesmo grupo.',
    ],
  },

  'list-items': {
    description: 'Linhas de lista usadas para exibir jogadores, histórico de jogos e seleções. Height fixo de 64px com padding lateral de 16px e border-radius de 24px.',
    variants: [
      { name: 'Jogador',    description: 'Avatar + nome + status (Confirmado / Pendente). Ação ao toque abre detalhe.' },
      { name: 'Histórico',  description: 'Dois times com escudos, placar central e data. Cor do vencedor em accent.' },
      { name: 'Selecionado', description: 'Borda colorida de 1.5px–2px no accent para indicar seleção ativa.' },
    ],
    behaviors: [
      'Height fixo 64px para todos os tipos.',
      'Padding: 16px lateral, 16px vertical.',
      'Border-radius: 24px (--radius-card).',
      'Fundo --color-surface-primary. Estado selecionado: borda 1.5px solid accent.',
      'Sempre usar gap de 8px entre avatar e texto.',
    ],
  },

  'badge-ranking': {
    description: 'Badge de pódio exibido no ranking de presença e Bola Cheia. Combina foto/iniciais do jogador com uma medalha sobreposta indicando a posição.',
    variants: [
      { name: '1º lugar', description: 'Medalha dourada (--color-surface-gold), texto escuro.' },
      { name: '2º lugar', description: 'Medalha prateada (--color-surface-silver), texto escuro.' },
      { name: '3º lugar', description: 'Medalha bronze (--color-surface-bronze), texto branco.' },
    ],
    behaviors: [
      'Foto/avatar: 110×110px, border-radius 24px.',
      'Medalha: 44px, circular, sobreposta no canto inferior central (top: 86px).',
      'A medalha tem borda de 2px na cor --color-bg para separar do avatar.',
      'Nome abaixo do avatar: 14px Medium. Contagem: 11px Regular em --color-fg-secondary.',
      'O pódio sempre exibe 2º à esquerda, 1º ao centro, 3º à direita.',
    ],
  },

  'bottom-sheet': {
    description: 'Painel deslizante a partir da base. Usado para seleção de jogadores, confirmações, resultados e detalhes. Sempre com radius 24px no topo e safe-area no bottom.',
    variants: [
      { name: 'Simples',      description: 'Header (título + fechar) + lista + botão CTA. Ex.: escolha de Bola Cheia/Murcha.' },
      { name: 'Com detalhe',  description: 'Avatar grande + stats em grid + ações. Ex.: detalhe de jogador.' },
      { name: 'Confirmação',  description: 'Mensagem curta + botão primário. Ex.: confirmar voto ou placar.' },
    ],
    behaviors: [
      'border-radius 24px 24px 0 0 no topo. Zero no bottom.',
      'Sempre tem botão de fechar (X) no header, 32×32px, fundo --color-surface-primary.',
      'Fundo: --color-bg. Padding: 24px lateral, 24px topo, 40px bottom + safe-area.',
      'Overlay de fundo: rgba(0,0,0,0.6) cobrindo a tela toda, fecha ao tocar.',
      'Gap de 24px entre o header da sheet e o conteúdo.',
      'Botão CTA sempre fixo na base com height 56px.',
    ],
    doList: [
      'Use gap de 8px entre itens da lista dentro da sheet.',
      'Sempre inclua o botão de fechar — nunca dependa só do overlay.',
    ],
    dontList: [
      'Não aninhe sheets — uma de cada vez.',
      'Não use bottom sheet para navegação — use Router.',
    ],
  },
}
