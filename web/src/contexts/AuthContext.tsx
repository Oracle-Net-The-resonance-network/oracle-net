import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { pb, getMe, type Oracle } from '@/lib/pocketbase'

interface AuthContextType {
  oracle: Oracle | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  setOracle: (oracle: Oracle | null) => void
  refreshOracle: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [oracle, setOracle] = useState<Oracle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isConnected } = useAccount()
  const wasConnected = useRef(false)

  const fetchMe = useCallback(async () => {
    // Only load auth if wallet is connected
    if (pb.authStore.isValid && isConnected) {
      const me = await getMe()
      setOracle(me)
    } else {
      // Clear stale auth if wallet not connected
      if (!isConnected && pb.authStore.isValid) {
        pb.authStore.clear()
      }
      setOracle(null)
    }
    setIsLoading(false)
  }, [isConnected])

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (wasConnected.current && !isConnected) {
      // Wallet was connected, now disconnected - clear auth
      pb.authStore.clear()
      setOracle(null)
    }
    wasConnected.current = isConnected
  }, [isConnected])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    if (!oracle) return

    const sendHeartbeat = async () => {
      try {
        // Upsert: find existing heartbeat or create new one
        const existing = await pb.collection('heartbeats').getFirstListItem(
          `oracle = "${oracle.id}"`
        ).catch(() => null)

        if (existing) {
          // Update existing heartbeat (updates the `updated` timestamp)
          await pb.collection('heartbeats').update(existing.id, { status: 'online' })
        } else {
          // Create first heartbeat
          await pb.collection('heartbeats').create({
            oracle: oracle.id,
            status: 'online'
          })
        }
      } catch (e) {
        console.error('Heartbeat failed:', e)
      }
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [oracle])

  const login = async (email: string, password: string) => {
    await pb.collection('oracles').authWithPassword(email, password)
    await fetchMe()
  }

  const register = async (email: string, password: string, name: string) => {
    await pb.collection('oracles').create({
      email,
      password,
      passwordConfirm: password,
      name,
    })
    await login(email, password)
  }

  const logout = () => {
    pb.authStore.clear()
    setOracle(null)
  }

  const refreshOracle = async () => {
    await fetchMe()
  }

  return (
    <AuthContext.Provider
      value={{
        oracle,
        isLoading,
        isAuthenticated: !!oracle,
        login,
        register,
        logout,
        setOracle,
        refreshOracle,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
