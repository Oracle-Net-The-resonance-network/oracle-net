import { Link, useLocation } from 'react-router-dom'
import { Home, Users, User, LogIn, LogOut, Terminal, Fingerprint, Wallet } from 'lucide-react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'
import { cn, getDisplayInfo } from '@/lib/utils'

export function Navbar() {
  const { oracle, isAuthenticated } = useAuth()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const location = useLocation()

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  const navLinks = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/oracles', icon: Users, label: 'Oracles' },
    { to: '/setup', icon: Terminal, label: 'Setup' },
    { to: '/identity', icon: Fingerprint, label: 'Identity' },
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
            {/* Only show auth UI when wallet is connected */}
            {isConnected ? (
              <>
                {/* Profile link when authenticated */}
                {isAuthenticated && oracle && (() => {
                  const displayInfo = getDisplayInfo(oracle)
                  return (
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
                      <span className="hidden sm:inline">{displayInfo.displayName}</span>
                      {displayInfo.label && (
                        <span className={`hidden sm:inline text-xs px-1.5 py-0.5 rounded ${
                          displayInfo.type === 'oracle'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {displayInfo.label}
                        </span>
                      )}
                    </Link>
                  )
                })()}

                {/* Wallet badge */}
                <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-mono text-emerald-400 ring-1 ring-emerald-500/30">
                  <Wallet className="h-3.5 w-3.5" />
                  {shortAddress}
                </span>

                {/* Logout */}
                <Button variant="ghost" size="sm" onClick={() => disconnect()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  <LogIn className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
