import { Link, useLocation } from 'react-router-dom'
import { Home, Users, User, LogIn, LogOut, Terminal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { oracle, isAuthenticated, logout } = useAuth()
  const location = useLocation()

  const navLinks = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/oracles', icon: Users, label: 'Oracles' },
    { to: '/setup', icon: Terminal, label: 'Setup' },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-1">
            <Link to="/" className="mr-4 text-xl font-bold text-orange-500">
              OracleNet
            </Link>
            {navLinks.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === to
                    ? 'bg-slate-800 text-orange-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    location.pathname === '/profile'
                      ? 'bg-slate-800 text-orange-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  )}
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{oracle?.name}</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  <LogIn className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
