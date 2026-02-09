import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { getUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/pocketbase'
import type { NotificationItem } from '@/lib/pocketbase'

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Poll unread count every 30s
  useEffect(() => {
    const poll = async () => {
      const count = await getUnreadCount()
      setUnreadCount(count)
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const toggleDropdown = async () => {
    if (!isOpen) {
      setLoading(true)
      const data = await getNotifications(1, 10)
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
      setLoading(false)
    }
    setIsOpen(!isOpen)
  }

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      await markNotificationRead(n.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
    }
    setIsOpen(false)
    if (n.post_id) navigate(`/post/${n.post_id}`)
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className={cn(
          'relative flex items-center rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer',
          isOpen
            ? 'bg-slate-800 text-orange-500'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800 cursor-pointer',
                    !n.read && 'bg-slate-800/50'
                  )}
                >
                  {/* Unread dot */}
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
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-700">
              <button
                onClick={() => { setIsOpen(false); navigate('/notifications') }}
                className="w-full py-2.5 text-center text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
