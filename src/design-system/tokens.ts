export interface Token {
  name: string
  value: string
  label?: string
}

export const COLORS_SURFACE: Token[] = [
  { name: '--color-bg',                    value: '#ffffff',  label: 'Background' },
  { name: '--color-surface-primary',       value: '#f8f8f8',  label: 'Surface Primary' },
  { name: '--color-surface-secondary',     value: '#efefef',  label: 'Surface Secondary' },
  { name: '--color-surface-accent',        value: '#082996',  label: 'Surface Accent' },
  { name: '--color-surface-accent-light',  value: '#e6f8ff',  label: 'Surface Accent Light' },
  { name: '--color-surface-accent-yellow', value: '#FFDC50',  label: 'Surface Accent Yellow' },
  { name: '--color-surface-white',         value: '#ffffff',  label: 'Surface White' },
  { name: '--color-surface-quaternary',    value: '#66d1ff',  label: 'Surface Quaternary' },
  { name: '--color-surface-gold',          value: '#fad026',  label: 'Surface Gold' },
  { name: '--color-surface-silver',        value: '#e9e3cc',  label: 'Surface Silver' },
  { name: '--color-surface-bronze',        value: '#bb9a15',  label: 'Surface Bronze' },
]

export const COLORS_FOREGROUND: Token[] = [
  { name: '--color-fg-primary',        value: '#1a1a1a', label: 'Foreground Primary' },
  { name: '--color-fg-secondary',      value: '#8e8e93', label: 'Foreground Secondary' },
  { name: '--color-fg-tertiary',       value: '#ffffff', label: 'Foreground Tertiary' },
  { name: '--color-fg-accent',         value: '#082996', label: 'Foreground Accent' },
  { name: '--color-fg-accent-light',   value: '#082996', label: 'Foreground Accent Light' },
  { name: '--color-fg-accent-yellow',  value: '#FFDC50', label: 'Foreground Accent Yellow' },
]

export const COLORS_SEMANTIC: Token[] = [
  { name: '--color-border',  value: '#efefef', label: 'Border' },
  { name: '--color-success', value: '#34c759', label: 'Success' },
  { name: '--color-warning', value: '#ff9500', label: 'Warning' },
  { name: '--color-danger',  value: '#ff3b30', label: 'Danger' },
]

export const COLORS_BUTTON: Token[] = [
  { name: '--btn-primary-bg',   value: '#082996', label: 'Button Primary BG' },
  { name: '--btn-primary-fg',   value: '#ffffff', label: 'Button Primary FG' },
  { name: '--btn-secondary-bg', value: '#e6f8ff', label: 'Button Secondary BG' },
  { name: '--btn-secondary-fg', value: '#082996', label: 'Button Secondary FG' },
]

export const COLORS_SPECIAL: Token[] = [
  { name: '--color-avatar-bg', value: '#66d1ff', label: 'Avatar BG' },
  { name: '--color-avatar-fg', value: '#082996', label: 'Avatar FG' },
  { name: '--color-info-bg',   value: '#e6f8ff', label: 'Info BG' },
  { name: '--color-info-fg',   value: '#082996', label: 'Info FG' },
  { name: '--color-number-bg', value: '#efefef', label: 'Number BG' },
  { name: '--color-number-fg', value: '#1a1a1a', label: 'Number FG' },
]

export const FONT_SIZES: Token[] = [
  { name: '--font-size-11', value: '11px', label: 'Size 11' },
  { name: '--font-size-12', value: '12px', label: 'Size 12' },
  { name: '--font-size-14', value: '14px', label: 'Size 14' },
  { name: '--font-size-16', value: '16px', label: 'Size 16 — Body' },
  { name: '--font-size-18', value: '18px', label: 'Size 18' },
  { name: '--font-size-24', value: '24px', label: 'Size 24 — Title' },
  { name: '--font-size-32', value: '32px', label: 'Size 32 — Display' },
]

export const SPACING: Token[] = [
  { name: '--space-8',  value: '8px',  label: 'Space 8' },
  { name: '--space-16', value: '16px', label: 'Space 16' },
  { name: '--space-24', value: '24px', label: 'Space 24' },
  { name: '--space-40', value: '40px', label: 'Space 40' },
]

export const RADII: Token[] = [
  { name: '--radius-tag',  value: '16px',    label: 'Tag' },
  { name: '--radius-card', value: '24px',    label: 'Card' },
  { name: '--radius-pill', value: '99999px', label: 'Pill' },
]
