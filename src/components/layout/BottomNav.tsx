import { NavLink } from 'react-router-dom'
import { CalendarDays, BarChart2, Wallet, User, Shield } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function BottomNav() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const tabs = [
    { to: '/games',    icon: CalendarDays, label: 'Jogo'     },
    { to: '/stats',    icon: BarChart2,    label: 'Stats'    },
    { to: '/caixinha', icon: Wallet,       label: 'Caixinha' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    { to: '/profile',  icon: User,         label: 'Perfil'   },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 safe-bottom z-50"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0px -0.33px 0px rgba(0,0,0,0.15)'
      }}>
      <div className="flex px-4 pb-1">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 transition-colors"
            style={({ isActive }) => ({
              color: isActive ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-12)',
              fontWeight: 600
            })}>
            <Icon size={22} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
