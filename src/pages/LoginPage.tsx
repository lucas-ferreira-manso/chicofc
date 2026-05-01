import { NavLink } from 'react-router-dom'
import { SoccerBall, ChartBar, PiggyBank, ShieldStar, User } from '@phosphor-icons/react'
import { useAuthStore } from '../../store/authStore'

export default function BottomNav() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const tabs = [
    { to: '/games',    icon: SoccerBall, label: 'Jogo'     },
    { to: '/stats',    icon: ChartBar,   label: 'Stats'    },
    { to: '/caixinha', icon: PiggyBank,  label: 'Caixinha' },
    ...(isAdmin ? [{ to: '/admin', icon: ShieldStar, label: 'Admin' }] : []),
    { to: '/profile',  icon: User,       label: 'Perfil'   },
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
        {tabs.map(({ to, icon: Icon, label }) => (
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
      </div>
    </nav>
  )
}
