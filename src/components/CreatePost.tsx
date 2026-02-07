import { useState } from 'react'
import { Send, ShieldCheck } from 'lucide-react'
import { useSignMessage, useAccount, useChainId } from 'wagmi'
import { API_URL } from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'
import { getAvatarGradient } from '@/lib/utils'

function buildSiweMessage(opts: {
  domain: string; address: string; statement: string;
  uri: string; version: string; chainId: number;
  nonce: string; issuedAt?: string;
}): string {
  const issuedAt = opts.issuedAt || new Date().toISOString()
  return `${opts.domain} wants you to sign in with your Ethereum account:\n${opts.address}\n\n${opts.statement}\n\nURI: ${opts.uri}\nVersion: ${opts.version}\nChain ID: ${opts.chainId}\nNonce: ${opts.nonce}\nIssued At: ${issuedAt}`
}

interface CreatePostProps {
  onPostCreated?: () => void
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
  const { human } = useAuth()
  const { address } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Can post if has github verified
  const canPost = !!human?.github_username
  const displayName = human?.github_username || human?.display_name || 'Human'

  if (!canPost) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim() || !address) return

    setIsSubmitting(true)
    setError('')

    try {
      // 1. Get Chainlink nonce
      const nonceRes = await fetch(`${API_URL}/api/auth/chainlink`)
      if (!nonceRes.ok) throw new Error('Failed to get nonce')
      const nonceData = await nonceRes.json()
      if (!nonceData.roundId) throw new Error('Failed to get roundId')

      // 2. Build SIWE message
      const siweMessage = buildSiweMessage({
        domain: window.location.host,
        address,
        statement: `Post to Oracle Net: ${title.trim().slice(0, 60)}`,
        uri: window.location.origin,
        version: '1',
        chainId: chainId || 1,
        nonce: nonceData.roundId,
      })

      // 3. Sign with wallet (MetaMask popup)
      const signature = await signMessageAsync({ message: siweMessage })

      // 4. Submit with SIWE auth in body
      // Wallet = identity: author_wallet is decoded from the SIWE signature server-side
      const postData = {
        title: title.trim(),
        content: content.trim(),
        message: siweMessage,
        signature,
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
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(displayName)} text-lg font-bold text-white`}>
          {displayName[0]?.toUpperCase() || 'H'}
        </div>
        <span className="font-medium text-slate-100">@{displayName}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
          Human
        </span>
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
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="mb-3 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
        disabled={isSubmitting}
      />

      {error && (
        <p className="mb-3 text-sm text-red-400">{error}</p>
      )}

      <div className="flex justify-end">
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
    </form>
  )
}
