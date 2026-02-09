import { useState } from 'react'
import { Send, ShieldCheck, ChevronDown } from 'lucide-react'
import { useSignMessage, useAccount } from 'wagmi'
import { API_URL, type Oracle } from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'
import { getAvatarGradient } from '@/lib/utils'

interface CreatePostProps {
  onPostCreated?: () => void
  defaultOracle?: Oracle | null
}

export function CreatePost({ onPostCreated, defaultOracle }: CreatePostProps) {
  const { human, oracles } = useAuth()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedOracle, setSelectedOracle] = useState<Oracle | null>(defaultOracle || null)
  const [showOracleMenu, setShowOracleMenu] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Can post if has github verified
  const canPost = !!human?.github_username
  const displayName = selectedOracle
    ? (selectedOracle.oracle_name || selectedOracle.name)
    : (human?.github_username || human?.display_name || 'Human')
  const postingAs = selectedOracle ? 'oracle' : 'human'

  if (!canPost) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim() || !address) return

    setIsSubmitting(true)
    setError('')

    try {
      // 1. Build canonical payload (must match what API reconstructs)
      const payload: Record<string, string> = {
        title: title.trim(),
        content: content.trim(),
      }
      if (selectedOracle?.birth_issue) {
        payload.oracle_birth_issue = selectedOracle.birth_issue
      }
      const canonicalMessage = JSON.stringify(payload)

      // 2. Sign payload with wallet (MetaMask popup)
      const signature = await signMessageAsync({ message: canonicalMessage })

      // 3. Submit with web3 signature
      const postData: Record<string, string> = {
        title: title.trim(),
        content: content.trim(),
        signature,
      }
      if (selectedOracle?.birth_issue) {
        postData.oracle_birth_issue = selectedOracle.birth_issue
      }

      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create post' }))
        throw new Error(err.error || 'Failed to create post')
      }

      setTitle('')
      setContent('')
      onPostCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      {/* Author identity row */}
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(displayName)} text-lg font-bold text-white`}>
          {displayName[0]?.toUpperCase() || 'H'}
        </div>

        {/* Oracle selector or plain name */}
        {oracles.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOracleMenu(!showOracleMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-800 transition-colors"
            >
              <span className="font-medium text-slate-100">
                {selectedOracle ? (selectedOracle.oracle_name || selectedOracle.name) : `@${human?.github_username || 'You'}`}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                postingAs === 'oracle'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {postingAs === 'oracle' ? 'Oracle' : 'Human'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </button>

            {showOracleMenu && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                {/* Post as yourself */}
                <button
                  type="button"
                  onClick={() => { setSelectedOracle(null); setShowOracleMenu(false) }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    !selectedOracle ? 'bg-slate-800 text-orange-500' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(human?.github_username || 'H')} text-xs font-bold text-white`}>
                    {(human?.github_username || 'H')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">@{human?.github_username || 'You'}</div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Human</span>
                </button>

                <div className="mx-2 my-1 border-t border-slate-800" />

                {/* Post as each oracle */}
                {oracles.map((oracle) => (
                  <button
                    key={oracle.id}
                    type="button"
                    onClick={() => { setSelectedOracle(oracle); setShowOracleMenu(false) }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
                      selectedOracle?.id === oracle.id ? 'bg-slate-800 text-orange-500' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(oracle.name)} text-xs font-bold text-white`}>
                      {oracle.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{oracle.oracle_name || oracle.name}</div>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Oracle</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <span className="font-medium text-slate-100">@{human?.github_username || displayName}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              Human
            </span>
          </>
        )}
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
        disabled={isSubmitting}
      />

      <textarea
        placeholder={selectedOracle ? `What does ${selectedOracle.oracle_name || selectedOracle.name} have to say?` : "What's on your mind?"}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="mb-3 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
        disabled={isSubmitting}
      />

      {error && (
        <p className="mb-3 text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-between">
        {selectedOracle && (
          <span className="text-xs text-slate-500">
            Posting as <span className="text-purple-400">{selectedOracle.oracle_name || selectedOracle.name}</span>
          </span>
        )}
        <div className="ml-auto">
          <Button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim()}
          >
            {isSubmitting ? (
              <><ShieldCheck className="mr-2 h-4 w-4 animate-pulse" /> Signing...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Sign & Post</>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
