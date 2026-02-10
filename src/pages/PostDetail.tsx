import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Send, ArrowBigUp, ArrowBigDown, ShieldCheck } from 'lucide-react'
import { useSignMessage, useAccount } from 'wagmi'
import { API_URL, votePost, getMyVotes, type Post, type Comment } from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/Button'
import { type DisplayableEntity } from '@/lib/utils'
import { AuthorBadge } from '@/components/AuthorBadge'
import { Web3Proof } from '@/components/Web3Proof'
import { Markdown } from '@/components/Markdown'


export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [authors, setAuthors] = useState<Map<string, DisplayableEntity>>(new Map())
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null)
  const [localUpvotes, setLocalUpvotes] = useState(0)
  const [localDownvotes, setLocalDownvotes] = useState(0)
  const [localScore, setLocalScore] = useState(0)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      const [postRes, commentsRes, feedRes] = await Promise.all([
        fetch(`${API_URL}/api/posts/${id}`),
        fetch(`${API_URL}/api/posts/${id}/comments`),
        fetch(`${API_URL}/api/feed?sort=new&limit=100`),
      ])

      const postData = await postRes.json()
      const commentsData = await commentsRes.json()
      const feedData = await feedRes.json()

      // Build authors map from feed (post authors) + comments (comment authors)
      const authorsMap = new Map<string, DisplayableEntity>()
      ;(feedData.posts || []).forEach((p: { author_wallet?: string; author?: Record<string, unknown> }) => {
        if (p.author_wallet && p.author) {
          authorsMap.set(p.author_wallet.toLowerCase(), p.author as unknown as DisplayableEntity)
        }
      })
      // Merge comment authors (resolved by API)
      ;(commentsData.items || []).forEach((c: { author_wallet?: string; author?: Record<string, unknown> }) => {
        if (c.author_wallet && c.author) {
          authorsMap.set(c.author_wallet.toLowerCase(), c.author as unknown as DisplayableEntity)
        }
      })

      setPost(postData)
      setLocalUpvotes(postData.upvotes || 0)
      setLocalDownvotes(postData.downvotes || 0)
      setLocalScore(postData.score || 0)
      setComments(commentsData.items || [])
      setAuthors(authorsMap)

      // Fetch user's vote on this post
      if (isAuthenticated && postData.id) {
        const votes = await getMyVotes([postData.id])
        setUserVote(votes[postData.id] ?? null)
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setIsLoading(false)
    }
  }, [id, isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleVote = async (direction: 'up' | 'down') => {
    if (!isAuthenticated || isVoting || !id) return
    setIsVoting(true)
    try {
      const result = await votePost(id, direction)
      if (result.success) {
        setLocalUpvotes(result.upvotes)
        setLocalDownvotes(result.downvotes)
        setLocalScore(result.score)
        setUserVote(result.user_vote)
      }
    } finally {
      setIsVoting(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !isAuthenticated || !id || !address) return

    setIsSubmitting(true)
    try {
      // Build content payload (same pattern as posts — signs WHAT was said)
      const payload = JSON.stringify({ content: newComment.trim(), post: id })

      // Sign the content payload with wallet
      const signature = await signMessageAsync({ message: payload })

      // Submit with content signature
      const res = await fetch(`${API_URL}/api/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          message: payload,
          signature,
        }),
      })

      if (!res.ok) throw new Error('Failed to create comment')

      setNewComment('')
      fetchData()
    } catch (err) {
      console.error('Failed to comment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }


  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-center text-slate-500">
        Post not found
      </div>
    )
  }

  const postAuthor = authors.get(post.author_wallet?.toLowerCase() || '') || null

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-slate-400 hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" /> Back to Feed
      </Link>

      <article className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="flex">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-1 p-3 border-r border-slate-800">
            <button
              onClick={() => handleVote('up')}
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
              onClick={() => handleVote('down')}
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
          <div className="flex-1 p-6">
            <div className="mb-4">
              <AuthorBadge author={postAuthor} wallet={post.author_wallet} created={post.created} size="md" />
            </div>
            <h1 className="mb-3 text-2xl font-bold text-slate-100">{post.title}</h1>
            <Markdown>{post.content}</Markdown>

            {/* Cryptographic proof */}
            {post.siwe_signature && (
              <Web3Proof signature={post.siwe_signature} message={post.siwe_message} signerWallet={post.author_wallet} />
            )}

            <div className="mt-4 text-xs text-slate-500">
              {localUpvotes} up · {localDownvotes} down
            </div>
          </div>
        </div>
      </article>

      <h2 className="mb-4 text-lg font-semibold text-slate-100">
        Comments ({comments.length})
      </h2>

      {isAuthenticated && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
            className="mb-3 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
            disabled={isSubmitting}
          />
          <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
            {isSubmitting ? (
              <><ShieldCheck className="mr-2 h-4 w-4 animate-pulse" /> Signing...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Sign & Comment</>
            )}
          </Button>
        </form>
      )}

      {comments.length === 0 ? (
        <p className="text-slate-500">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const commentAuthor = authors.get(comment.author_wallet?.toLowerCase()) || null
            return (
              <div key={comment.id} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                <div className="mb-2">
                  <AuthorBadge author={commentAuthor} wallet={comment.author_wallet} created={comment.created} />
                </div>
                <Markdown>{comment.content}</Markdown>
                {comment.siwe_signature && (
                  <Web3Proof signature={comment.siwe_signature} message={comment.siwe_message} signerWallet={comment.author_wallet} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
