import { useState, useEffect, useRef } from 'react'
import {
  COLORS_SURFACE, COLORS_FOREGROUND, COLORS_SEMANTIC, COLORS_BUTTON, COLORS_SPECIAL,
  FONT_SIZES, SPACING, RADII
} from './tokens'
import {
  Section, SubSection,
  ColorGrid, TypographyRow, SpacingRow, RadiusRow, ButtonsPreview
} from './components'
import {
  HeaderPreview, BottomNavPreview, TabsPreview, TogglePreview,
  CardsPreview, ListItemPreview, AvatarPreview, BadgeRankingPreview, BottomSheetPreview
} from './ui-components'

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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active }: { active: string }) {
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
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
// Wrapper que injeta id + padding para o scroll-spy

function DSSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ scrollMarginTop: 32 }}>
      <Section title={title}>
        {children}
      </Section>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [activeId, setActiveId] = useState(ALL_IDS[0])
  const observerRef = useRef<IntersectionObserver | null>(null)

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
      <Sidebar active={activeId} />

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

        {/* ── Foundations ── */}
        <DSSection id="colors" title="Colors">
          <SubSection title="Surface">
            <ColorGrid tokens={COLORS_SURFACE} />
          </SubSection>
          <SubSection title="Foreground">
            <ColorGrid tokens={COLORS_FOREGROUND} />
          </SubSection>
          <SubSection title="Semantic">
            <ColorGrid tokens={COLORS_SEMANTIC} />
          </SubSection>
          <SubSection title="Buttons">
            <ColorGrid tokens={COLORS_BUTTON} />
          </SubSection>
          <SubSection title="Special">
            <ColorGrid tokens={COLORS_SPECIAL} />
          </SubSection>
        </DSSection>

        <DSSection id="typography" title="Typography">
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

        <DSSection id="spacing" title="Spacing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SPACING.map(t => <SpacingRow key={t.name} token={t} />)}
          </div>
        </DSSection>

        <DSSection id="border-radius" title="Border Radius">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RADII.map(t => <RadiusRow key={t.name} token={t} />)}
          </div>
        </DSSection>

        {/* ── Components ── */}
        <DSSection id="buttons" title="Buttons">
          <ButtonsPreview />
        </DSSection>

        <DSSection id="header" title="Header">
          <HeaderPreview />
        </DSSection>

        <DSSection id="bottom-nav" title="Bottom Nav">
          <BottomNavPreview />
        </DSSection>

        <DSSection id="tabs" title="Tabs">
          <TabsPreview />
        </DSSection>

        <DSSection id="toggle" title="Toggle">
          <TogglePreview />
        </DSSection>

        <DSSection id="avatar" title="Avatar">
          <AvatarPreview />
        </DSSection>

        <DSSection id="cards" title="Cards">
          <CardsPreview />
        </DSSection>

        <DSSection id="list-items" title="List Items">
          <ListItemPreview />
        </DSSection>

        <DSSection id="badge-ranking" title="Badge Ranking">
          <BadgeRankingPreview />
        </DSSection>

        <DSSection id="bottom-sheet" title="Bottom Sheet">
          <BottomSheetPreview />
        </DSSection>
      </main>
    </div>
  )
}
