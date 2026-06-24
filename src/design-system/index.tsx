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

export default function DesignSystemPage() {
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--color-bg)',
      padding: '32px 24px 80px',
      display: 'flex', flexDirection: 'column', gap: 48,
      maxWidth: 800, margin: '0 auto'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/team-blue.png" alt="ChicoFC" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <h1 style={{
            fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24,
            color: 'var(--color-fg-primary)', margin: 0
          }}>
            ChicoFC Design System
          </h1>
        </div>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 14, color: 'var(--color-fg-secondary)', margin: 0 }}>
          Tokens extraídos de <code style={{ fontFamily: 'monospace', fontSize: 12 }}>src/index.css</code> · Clique no token para copiar
        </p>
      </div>

      {/* Colors */}
      <Section title="Colors">
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
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div style={{
          padding: '16px 20px', borderRadius: 16, background: 'var(--color-surface-primary)',
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
      </Section>

      {/* Spacing */}
      <Section title="Spacing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SPACING.map(t => <SpacingRow key={t.name} token={t} />)}
        </div>
      </Section>

      {/* Border Radius */}
      <Section title="Border Radius">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RADII.map(t => <RadiusRow key={t.name} token={t} />)}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <ButtonsPreview />
      </Section>

      {/* Header */}
      <Section title="Header">
        <HeaderPreview />
      </Section>

      {/* Bottom Nav */}
      <Section title="Bottom Nav">
        <BottomNavPreview />
      </Section>

      {/* Tabs */}
      <Section title="Tabs">
        <TabsPreview />
      </Section>

      {/* Toggle */}
      <Section title="Toggle">
        <TogglePreview />
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        <AvatarPreview />
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <CardsPreview />
      </Section>

      {/* List Items */}
      <Section title="List Items">
        <ListItemPreview />
      </Section>

      {/* Badge Ranking */}
      <Section title="Badge Ranking">
        <BadgeRankingPreview />
      </Section>

      {/* Bottom Sheet */}
      <Section title="Bottom Sheet">
        <BottomSheetPreview />
      </Section>

    </div>
  )
}
