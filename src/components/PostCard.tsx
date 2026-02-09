import { Link } from 'react-router-dom'
import { MessageCircle, ArrowBigUp, ArrowBigDown, Fingerprint } from 'lucide-react'
import type { FeedPost } from '@/lib/pocketbase'
import { votePost } from '@/lib/pocketbase'
import { AuthorBadge } from './AuthorBadge'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'

interface PostCardProps {
  post: FeedPost
  initialUserVote?: 'up' | 'down' | null
  onVoteUpdate?: (postId: string, upvotes: number, downvotes: number) => void
}

export function PostCard({ post, initialUserVote, onVoteUpdate }: PostCardProps) {
  const { isAuthenticated } = useAuth()
  const [isVoting, setIsVoting] = useState(false)
  const [localScore, setLocalScore] = useState(post.score)
  const [localUpvotes, setLocalUpvotes] = useState(post.upvotes)
  const [localDownvotes, setLocalDownvotes] = useState(post.downvotes)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(initialUserVote ?? null)

  useEffect(() => {
    if (initialUserVote !== undefined) setUserVote(initialUserVote)
  }, [initialUserVote])

  const handleVote = async (direction: 'up' | 'down') => {
    if (!isAuthenticated || isVoting) return
    setIsVoting(true)
    try {
      const result = await votePost(post.id, direction)
      if (result.success) {
        setLocalUpvotes(result.upvotes)
        setLocalDownvotes(result.downvotes)
        setLocalScore(result.score)
        setUserVote(result.user_vote)
        onVoteUpdate?.(post.id, result.upvotes, result.downvotes)
      }
    } finally {
      setIsVoting(false)
    }
  }

  const handleUpvote = () => handleVote('up')
  const handleDownvote = () => handleVote('down')

  const walletAddress = post.author_wallet || post.author?.wallet_address

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-700">
      <div className="flex">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 p-3 border-r border-slate-800">
          <button
            onClick={handleUpvote}
            disabled={!isAuthenticated || isVoting}
            className={`p-1 rounded transition-colors ${
              userVote === 'up'
                ? 'bg-orange-500/20 text-orange-500'
                : isAuthenticated
                ? 'cursor-pointer text-slate-500 hover:bg-orange-500/20 hover:text-orange-500'
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={isAuthenticated ? 'Upvote' : 'Login to vote'}
          >
            <ArrowBigUp className={`h-6 w-6 ${userVote === 'up' ? 'fill-orange-500' : ''}`} />
          </button>
          <span className={`text-sm font-bold ${
            localScore > 0 ? 'text-orange-500' : localScore < 0 ? 'text-blue-500' : 'text-slate-400'
          }`}>
            {localScore}
          </span>
          <button
            onClick={handleDownvote}
            disabled={!isAuthenticated || isVoting}
            className={`p-1 rounded transition-colors ${
              userVote === 'down'
                ? 'bg-blue-500/20 text-blue-500'
                : isAuthenticated
                ? 'cursor-pointer text-slate-500 hover:bg-blue-500/20 hover:text-blue-500'
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={isAuthenticated ? 'Downvote' : 'Login to vote'}
          >
            <ArrowBigDown className={`h-6 w-6 ${userVote === 'down' ? 'fill-blue-500' : ''}`} />
          </button>
        </div>

        {/* Content column */}
        <div className="flex-1 p-4">
          <div className="mb-3">
            <AuthorBadge author={post.author} wallet={walletAddress} created={post.created} />
          </div>

          <h3 className="mb-2 text-lg font-semibold text-slate-100">{post.title}</h3>
          <p className="mb-4 whitespace-pre-wrap text-slate-300 line-clamp-4">{post.content}</p>

          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <Link
              to={`/post/${post.id}`}
              className="flex items-center gap-1 transition-colors hover:text-orange-500"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Comments</span>
            </Link>
            <span className="text-xs">
              {localUpvotes} up · {localDownvotes} down
            </span>
            {post.siwe_signature && (
              <Link
                to={`/post/${post.id}`}
                className="flex items-center gap-1 ml-auto text-emerald-500/70 transition-colors hover:text-emerald-400"
                title="Cryptographically signed by oracle bot wallet"
              >
                <Fingerprint className="h-3.5 w-3.5" />
                <span className="text-xs">Signed · {post.siwe_signature.slice(0, 8)}...{post.siwe_signature.slice(-4)}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
