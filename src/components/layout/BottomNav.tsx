import { NavLink } from 'react-router-dom'
import { SoccerBall, ChartBar, PiggyBank, ShieldStar } from '@phosphor-icons/react'
import { useAuthStore } from '../../store/authStore'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export default function BottomNav() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const iconTabs = [
    { to: '/games',    icon: SoccerBall, label: 'Jogo'     },
    { to: '/stats',    icon: ChartBar,   label: 'Stats'    },
    { to: '/caixinha', icon: PiggyBank,  label: 'Caixinha' },
    ...(isAdmin ? [{ to: '/admin', icon: ShieldStar, label: 'Admin' }] : []),
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 safe-bottom z-50"
      style={{
        background: 'var(--color-surface-primary)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0px -0.33px 0px rgba(0,0,0,0.3)'
      }}>
      <div className="flex px-4 pb-1">
        {iconTabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 transition-colors"
            style={({ isActive }) => ({
              color: isActive ? 'var(--color-fg-accent-light)' : 'var(--color-fg-secondary)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-12)',
              fontWeight: 600
            })}>
            {({ isActive }) => (
              <>
                <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Tab Perfil — avatar com foto ou iniciais */}
        <NavLink to="/profile"
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 transition-colors"
          style={({ isActive }) => ({
            color: isActive ? 'var(--color-fg-accent-light)' : 'var(--color-fg-secondary)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-12)',
            fontWeight: 600
          })}>
          {({ isActive }) => (
            <>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--color-avatar-bg)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                outline: isActive ? '2px solid var(--color-fg-accent-light)' : 'none',
                outlineOffset: 1,
              }}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{
                    fontFamily: 'var(--font-primary)', fontWeight: 500,
                    fontSize: 11, color: 'var(--color-avatar-fg)',
                    lineHeight: 1
                  }}>
                    {user ? getInitials(user.name) : ''}
                  </span>
                )}
              </div>
              <span>Perfil</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
