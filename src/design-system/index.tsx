import { useState, useEffect, useRef } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import {
  COLORS_SURFACE, COLORS_FOREGROUND, COLORS_SEMANTIC, COLORS_BUTTON, COLORS_SPECIAL,
  FONT_SIZES, SPACING, RADII
} from './tokens'
import {
  Section, SubSection, DocBlock,
  ColorGrid, TypographyRow, SpacingRow, RadiusRow, ButtonsPreview
} from './components'
import {
  HeaderPreview, BottomNavPreview, TabsPreview, TogglePreview,
  CardsPreview, ListItemPreview, AvatarPreview, BadgeRankingPreview, BottomSheetPreview
} from './ui-components'
import { DOCS } from './docs'

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV = [
  {
    group: 'Foundations',
    items: [
      { id: 'colors',        label: 'Colors'        },
      { id: 'typography',    label: 'Typography'    },
      { id: 'spacing',       label: 'Spacing'       },
      { id: 'border-radius', label: 'Border Radius' },
    ]
  },
  {
    group: 'Components',
    items: [
      { id: 'buttons',       label: 'Buttons'       },
      { id: 'header',        label: 'Header'        },
      { id: 'bottom-nav',    label: 'Bottom Nav'    },
      { id: 'tabs',          label: 'Tabs'          },
      { id: 'toggle',        label: 'Toggle'        },
      { id: 'avatar',        label: 'Avatar'        },
      { id: 'cards',         label: 'Cards'         },
      { id: 'list-items',    label: 'List Items'    },
      { id: 'badge-ranking', label: 'Badge Ranking' },
      { id: 'bottom-sheet',  label: 'Bottom Sheet'  },
    ]
  },
]

const ALL_IDS = NAV.flatMap(g => g.items.map(i => i.id))

// ─── Dark mode toggle ─────────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggle() {
    const html = document.documentElement
    if (dark) {
      html.classList.remove('dark')
      html.classList.add('light')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
    }
    setDark(!dark)
  }

  // Cleanup ao sair da página
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark', 'light')
    }
  }, [])

  return { dark, toggle }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, dark, onToggleDark }: { active: string; dark: boolean; onToggleDark: () => void }) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100dvh',
      overflowY: 'auto',
      padding: '24px 0 40px',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      background: 'var(--color-bg)',
    }}>
      {/* Logo + dark toggle */}
      <div style={{ padding: '0 16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/team-blue.png" alt="ChicoFC" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <div>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 13, color: 'var(--color-fg-primary)', margin: 0, lineHeight: 1.2 }}>
              ChicoFC
            </p>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-secondary)', margin: 0, lineHeight: 1.2 }}>
              Design System
            </p>
          </div>
        </div>

        {/* Dark mode button */}
        <button
          onClick={onToggleDark}
          title={dark ? 'Modo claro' : 'Modo escuro'}
          style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: dark ? 'var(--color-surface-secondary)' : 'var(--color-surface-primary)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          {dark
            ? <Sun size={16} color="var(--color-fg-primary)" weight="fill" />
            : <Moon size={16} color="var(--color-fg-primary)" weight="fill" />
          }
        </button>
      </div>

      {/* Dark mode badge */}
      {dark && (
        <div style={{
          margin: '0 16px 16px',
          padding: '6px 10px',
          borderRadius: 10,
          background: 'var(--color-surface-secondary)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Moon size={12} color="var(--color-fg-secondary)" weight="fill" />
          <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 500, color: 'var(--color-fg-secondary)' }}>
            Dark mode ativo
          </span>
        </div>
      )}

      {/* Nav groups */}
      {NAV.map(({ group, items }) => (
        <div key={group} style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 11,
            color: 'var(--color-fg-secondary)', margin: 0,
            padding: '8px 20px 6px',
            textTransform: 'uppercase', letterSpacing: '0.07em'
          }}>
            {group}
          </p>
          {items.map(({ id, label }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 20px',
                  background: isActive ? 'var(--color-surface-primary)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  borderLeft: isActive ? '2px solid var(--color-surface-accent)' : '2px solid transparent',
                  transition: 'background 0.12s, border-color 0.12s',
                }}>
                <span style={{
                  fontFamily: 'var(--font-primary)', fontWeight: isActive ? 600 : 400,
                  fontSize: 14, lineHeight: 1.4,
                  color: isActive ? 'var(--color-fg-accent)' : 'var(--color-fg-primary)',
                  transition: 'color 0.12s',
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

// ─── DSSection ────────────────────────────────────────────────────────────────

function DSSection({
  id, title, docKey, preview, children
}: {
  id: string
  title: string
  docKey?: string
  preview?: React.ReactNode
  children?: React.ReactNode
}) {
  const doc = docKey ? DOCS[docKey] : undefined

  return (
    <div id={id} style={{ scrollMarginTop: 32 }}>
      <Section title={title}>
        {/* Docs sempre primeiro */}
        {doc && <DocBlock doc={doc} />}

        {/* Divider entre docs e preview se há os dois */}
        {doc && (preview || children) && (
          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
        )}

        {/* Label "Preview" quando há doc */}
        {doc && (preview || children) && (
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 11,
            color: 'var(--color-fg-secondary)', margin: 0,
            textTransform: 'uppercase', letterSpacing: '0.07em'
          }}>
            Preview
          </p>
        )}

        {preview}
        {children}
      </Section>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [activeId, setActiveId] = useState(ALL_IDS[0])
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { dark, toggle } = useDarkMode()

  useEffect(() => {
    const options = { rootMargin: '-20% 0px -70% 0px', threshold: 0 }

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveId(entry.target.id)
      })
    }, options)

    ALL_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div style={{
      display: 'flex', minHeight: '100dvh',
      background: 'var(--color-bg)',
      fontFamily: 'var(--font-primary)'
    }}>
      <Sidebar active={activeId} dark={dark} onToggleDark={toggle} />

      {/* Main content */}
      <main style={{
        flex: 1, minWidth: 0,
        padding: '40px 40px 120px',
        display: 'flex', flexDirection: 'column', gap: 64,
        maxWidth: 760,
      }}>
        {/* Page header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 28, color: 'var(--color-fg-primary)', margin: 0 }}>
            Design System
          </h1>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 14, color: 'var(--color-fg-secondary)', margin: 0 }}>
            Tokens e componentes do ChicoFC · Fonte da verdade em{' '}
            <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--color-surface-secondary)', padding: '1px 5px', borderRadius: 4 }}>
              src/index.css
            </code>
          </p>
        </div>

        {/* ── Colors ── */}
        <DSSection id="colors" title="Colors">
          <SubSection title="Surface">
            <DocBlock doc={DOCS['colors-surface']} />
            <ColorGrid tokens={COLORS_SURFACE} />
          </SubSection>
          <SubSection title="Foreground">
            <DocBlock doc={DOCS['colors-foreground']} />
            <ColorGrid tokens={COLORS_FOREGROUND} />
          </SubSection>
          <SubSection title="Semantic">
            <DocBlock doc={DOCS['colors-semantic']} />
            <ColorGrid tokens={COLORS_SEMANTIC} />
          </SubSection>
          <SubSection title="Buttons">
            <DocBlock doc={DOCS['colors-button']} />
            <ColorGrid tokens={COLORS_BUTTON} />
          </SubSection>
          <SubSection title="Special">
            <DocBlock doc={DOCS['colors-special']} />
            <ColorGrid tokens={COLORS_SPECIAL} />
          </SubSection>
        </DSSection>

        {/* ── Typography ── */}
        <DSSection id="typography" title="Typography" docKey="typography">
          <div style={{
            padding: '16px 20px', borderRadius: 16,
            background: 'var(--color-surface-primary)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-secondary)' }}>
              Font Family
            </span>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
              Poppins
            </span>
          </div>
          <SubSection title="Sizes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FONT_SIZES.map(t => <TypographyRow key={t.name} token={t} />)}
            </div>
          </SubSection>
        </DSSection>

        {/* ── Spacing ── */}
        <DSSection id="spacing" title="Spacing" docKey="spacing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SPACING.map(t => <SpacingRow key={t.name} token={t} />)}
          </div>
        </DSSection>

        {/* ── Border Radius ── */}
        <DSSection id="border-radius" title="Border Radius" docKey="border-radius">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RADII.map(t => <RadiusRow key={t.name} token={t} />)}
          </div>
        </DSSection>

        {/* ── Components ── */}
        <DSSection id="buttons"       title="Buttons"       docKey="buttons"       preview={<ButtonsPreview />} />
        <DSSection id="header"        title="Header"        docKey="header"        preview={<HeaderPreview />} />
        <DSSection id="bottom-nav"    title="Bottom Nav"    docKey="bottom-nav"    preview={<BottomNavPreview />} />
        <DSSection id="tabs"          title="Tabs"          docKey="tabs"          preview={<TabsPreview />} />
        <DSSection id="toggle"        title="Toggle"        docKey="toggle"        preview={<TogglePreview />} />
        <DSSection id="avatar"        title="Avatar"        docKey="avatar"        preview={<AvatarPreview />} />
        <DSSection id="cards"         title="Cards"         docKey="cards"         preview={<CardsPreview />} />
        <DSSection id="list-items"    title="List Items"    docKey="list-items"    preview={<ListItemPreview />} />
        <DSSection id="badge-ranking" title="Badge Ranking" docKey="badge-ranking" preview={<BadgeRankingPreview />} />
        <DSSection id="bottom-sheet"  title="Bottom Sheet"  docKey="bottom-sheet"  preview={<BottomSheetPreview />} />
      </main>
    </div>
  )
}
