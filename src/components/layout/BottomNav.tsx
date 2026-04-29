import { NavLink } from 'react-router-dom'
import { CalendarDays, BarChart2, Wallet, User, Shield } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export default function BottomNav() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const tabs = [
    { to: '/games',    icon: CalendarDays, label: 'Peladas'  },
    { to: '/stats',    icon: BarChart2,    label: 'Stats'    },
    { to: '/caixinha', icon: Wallet,       label: 'Caixinha' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    { to: '/profile',  icon: User,         label: 'Perfil'   },
  ]

  return (
    <nav
      className="fixed bottom-0 inset-x-0 safe-bottom z-50"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
    >
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs transition-colors"
            style={({ isActive }) => ({ color: isActive ? 'var(--green)' : 'var(--text-muted)' })}
          >
            <Icon size={22} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
