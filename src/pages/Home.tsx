import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, RefreshCw, Flame, Clock, TrendingUp, Zap, Wallet, Fingerprint } from 'lucide-react'
import { useAccount } from 'wagmi'
import { getFeed, type FeedPost, type SortType } from '@/lib/pocketbase'
import { PostCard } from '@/components/PostCard'
import { CreatePost } from '@/components/CreatePost'
import { Button } from '@/components/Button'
import { useAuth } from '@/contexts/AuthContext'

const SORT_OPTIONS: { value: SortType; label: string; icon: React.ElementType }[] = [
  { value: 'hot', label: 'Hot', icon: Flame },
  { value: 'new', label: 'New', icon: Clock },
  { value: 'top', label: 'Top', icon: TrendingUp },
  { value: 'rising', label: 'Rising', icon: Zap },
]

export function Home() {
  const { isAuthenticated } = useAuth()
  const { address, isConnected } = useAccount()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortType, setSortType] = useState<SortType>('hot')

  const fetchPosts = useCallback(async () => {
    try {
      setError('')
      const result = await getFeed(sortType, 50)
      if (result.success) {
        setPosts(result.posts)
      } else {
        setError('Failed to load feed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
    } finally {
      setIsLoading(false)
    }
  }, [sortType])

  useEffect(() => {
    setIsLoading(true)
    fetchPosts()
  }, [fetchPosts])

  const handleRefresh = () => {
    setIsLoading(true)
    fetchPosts()
  }

  const handleVoteUpdate = (postId: string, upvotes: number, downvotes: number) => {
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, upvotes, downvotes, score: upvotes - downvotes }
        : p
    ))
  }

  // Gate feed behind wallet connection
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 p-3">
              <Fingerprint className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Connect to View Feed</h1>
          <p className="mt-2 text-slate-400">Connect your wallet to access the Oracle network feed.</p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-medium text-white hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-100">Feed</h1>
          {address && (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-mono text-emerald-400 ring-1 ring-emerald-500/30">
              <Wallet className="h-3 w-3" />
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Sort tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-800 pb-3">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setSortType(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortType === value
                ? 'bg-orange-500/20 text-orange-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {isAuthenticated && (
        <div className="mb-6">
          <CreatePost onPostCreated={handleRefresh} />
        </div>
      )}

      {isLoading && posts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400">
          {error}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500">
          No posts yet. Be the first to share something!
        </div>
       ) : (
         <div className="space-y-4">
           {posts.map((post) => (
            <PostCard key={post.id} post={post} onVoteUpdate={handleVoteUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
