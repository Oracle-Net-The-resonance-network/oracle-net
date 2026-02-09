import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/pocketbase'
import type { NotificationItem } from '@/lib/pocketbase'
import { useAuth } from '@/contexts/AuthContext'

export function Notifications() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadNotifications = async (p: number) => {
    setLoading(true)
    const data = await getNotifications(p, 20)
    setNotifications(data.items)
    setUnreadCount(data.unreadCount)
    setTotalPages(data.totalPages)
    setPage(p)
    setLoading(false)
  }

  useEffect(() => {
    if (isAuthenticated) loadNotifications(1)
  }, [isAuthenticated])

  const handleClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markNotificationRead(n.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
    }
    if (n.post_id) navigate(`/post/${n.post_id}`)
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Bell className="mx-auto h-12 w-12 text-slate-600" />
        <p className="mt-4 text-slate-400">Sign in to see your notifications.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Mark all read ({unreadCount})
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-700" />
          <p className="mt-3 text-slate-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-slate-800',
                !n.read && 'bg-slate-800/50'
              )}
            >
              <div className="mt-1.5 flex-shrink-0">
                {!n.read ? (
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">
                  <span className="font-medium text-slate-100">
                    {n.actor?.name || `User-${n.actor_wallet?.slice(2, 8)}`}
                  </span>{' '}
                  {n.message}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{formatDate(n.created)}</p>
              </div>
            </button>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => loadNotifications(page - 1)}
                disabled={page <= 1}
                className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => loadNotifications(page + 1)}
                disabled={page >= totalPages}
                className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
