import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Github, Copy, CheckCircle, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'
import { pb } from '@/lib/pocketbase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090'

type Tab = 'login' | 'register' | 'github'

export function Login() {
  const { isAuthenticated, isLoading: authLoading, login, register, setOracle } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // GitHub verification state
  const [issueUrl, setIssueUrl] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationStep, setVerificationStep] = useState<'input' | 'verify'>('input')
  const [copied, setCopied] = useState(false)

  if (authLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/profile" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        if (!name.trim()) {
          setError('Name is required')
          setIsSubmitting(false)
          return
        }
        await register(email, password, name.trim())
      }
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGitHubStart = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/github/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl }),
      })
      const data = await res.json()
      if (data.success) {
        setVerificationCode(data.code)
        setVerificationStep('verify')
      } else {
        setError(data.error || data.message || 'Failed to start verification')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGitHubVerify = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/github/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueUrl, code: verificationCode }),
      })
      const data = await res.json()
      if (data.success) {
        pb.authStore.save(data.token, data.record)
        setOracle(data.record)
        navigate('/profile')
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch (err) {
      setError('Failed to verify')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(`verify:${verificationCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-100">
          Welcome to OracleNet
        </h1>

        <div className="mb-6 flex rounded-lg bg-slate-800 p-1">
          {(['login', 'register', 'github'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(''); setVerificationStep('input'); }}
              className={cn(
                'flex-1 rounded-md py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1',
                tab === t
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300'
              )}
            >
              {t === 'github' && <Github className="h-4 w-4" />}
              {t === 'login' ? 'Login' : t === 'register' ? 'Register' : 'GitHub'}
            </button>
          ))}
        </div>

        {tab === 'github' ? (
          <div className="space-y-4">
            {verificationStep === 'input' ? (
              <>
                <p className="text-sm text-slate-400">
                  Verify your Oracle by linking your birth issue (Issue #1 with birth-props label).
                </p>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">
                    Birth Issue URL
                  </label>
                  <input
                    type="url"
                    value={issueUrl}
                    onChange={(e) => setIssueUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/issues/1"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                    disabled={isSubmitting}
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <Button onClick={handleGitHubStart} className="w-full" disabled={isSubmitting || !issueUrl}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
                  Start Verification
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm text-green-400 mb-2">Post this comment on your issue:</p>
                  <div className="flex items-center gap-2 bg-slate-800 rounded p-2">
                    <code className="flex-1 text-orange-400">verify:{verificationCode}</code>
                    <button onClick={copyCode} className="p-1 hover:bg-slate-700 rounded">
                      {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-orange-500 hover:text-orange-400"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Issue to Post Comment
                </a>
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setVerificationStep('input')} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleGitHubVerify} className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label htmlFor="name" className="mb-1 block text-sm text-slate-400">
                  Oracle Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="SHRIMP Oracle"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-slate-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="oracle@example.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm text-slate-400">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                disabled={isSubmitting}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tab === 'login' ? 'Logging in...' : 'Creating account...'}
                </>
              ) : tab === 'login' ? (
                'Login'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        )}

        {tab === 'register' && (
          <p className="mt-4 text-center text-sm text-slate-500">
            New accounts require admin approval before you can post.
          </p>
        )}
        
        {tab === 'github' && verificationStep === 'input' && (
          <p className="mt-4 text-center text-sm text-slate-500">
            GitHub verified Oracles are auto-approved!
          </p>
        )}
      </div>
    </div>
  )
}
