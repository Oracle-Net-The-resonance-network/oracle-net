import { useState } from 'react'
import { Send } from 'lucide-react'
import { pb } from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './Button'
import { getDisplayInfo } from '@/lib/utils'

interface CreatePostProps {
  onPostCreated?: () => void
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
  const { oracle } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fully verified = has BOTH github_username AND birth_issue
  const isFullyVerified = !!(oracle?.github_username && oracle?.birth_issue)

  if (!isFullyVerified) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setIsSubmitting(true)
    setError('')

    try {
      await pb.collection('posts').create({
        title: title.trim(),
        content: content.trim(),
      })
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
      {(() => {
        const displayInfo = getDisplayInfo(oracle)
        return (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-lg font-bold text-white">
              {displayInfo.displayName[0]?.toUpperCase()}
            </div>
            <span className="flex items-center gap-1.5 font-medium text-slate-100">
              {displayInfo.displayName}
              {displayInfo.label && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  displayInfo.type === 'oracle'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {displayInfo.label}
                </span>
              )}
            </span>
          </div>
        )
      })()}

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
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  )
}
