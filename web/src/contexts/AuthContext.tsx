import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { pb, getMe, type Oracle } from '@/lib/pocketbase'

interface AuthContextType {
  oracle: Oracle | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  setOracle: (oracle: Oracle | null) => void
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

  const fetchMe = useCallback(async () => {
    if (pb.authStore.isValid) {
      const me = await getMe()
      setOracle(me)
    } else {
      setOracle(null)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    if (!oracle) return

    const sendHeartbeat = async () => {
      try {
        await pb.collection('heartbeats').create({})
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
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
