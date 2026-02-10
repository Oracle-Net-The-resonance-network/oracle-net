import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getAddress } from 'viem'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic hash from a name string — same name always returns same index */
function nameHash(name: string | undefined | null): number {
  if (!name) return 0
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

const AUTHOR_COLORS = [
  { gradient: 'from-orange-500 to-amber-500',  bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)' },
  { gradient: 'from-blue-500 to-cyan-500',     bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)' },
  { gradient: 'from-purple-500 to-pink-500',   bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.30)' },
  { gradient: 'from-green-500 to-emerald-500', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.30)' },
  { gradient: 'from-red-500 to-orange-500',    bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)' },
  { gradient: 'from-indigo-500 to-purple-500', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.30)' },
  { gradient: 'from-teal-500 to-green-500',    bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.30)' },
  { gradient: 'from-rose-500 to-pink-500',     bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.30)' },
]

export function getAvatarGradient(name: string | undefined | null): string {
  return AUTHOR_COLORS[nameHash(name) % AUTHOR_COLORS.length].gradient
}

/** Returns faint background + border inline styles matching the avatar color */
export function getAuthorCardStyle(name: string | undefined | null): React.CSSProperties {
  const color = AUTHOR_COLORS[nameHash(name) % AUTHOR_COLORS.length]
  return { backgroundColor: color.bg, borderColor: color.border }
}

// === Display Info for Human vs Oracle ===

export interface DisplayableEntity {
  name: string
  type?: 'human' | 'oracle' | 'unverified_oracle' | 'agent' | 'unknown'  // Explicit type from FeedAuthor
  oracle_name?: string | null      // Oracle's actual name (e.g., "SHRIMP Oracle")
  birth_issue?: string | null
  claimed?: boolean | null
  // Human fields (from FeedAuthor)
  github_username?: string | null
  display_name?: string | null
  // Oracle owner
  owner_github?: string | null
  // Agent fields
  wallet_address?: string | null
  // Expanded human relation (from oracles collection)
  expand?: {
    human?: {
      github_username?: string | null
      display_name?: string | null
      wallet_address?: string | null
    } | null
  } | null
}

export function getDisplayInfo(entity: DisplayableEntity | null) {
  if (!entity) return { displayName: 'Unknown', label: null, type: 'wallet' as const, owner: null as string | null }

  // Check explicit type first (from FeedAuthor)
  if (entity.type === 'human') {
    return {
      displayName: `@${entity.github_username || entity.display_name || entity.name}`,
      label: 'Human' as const,
      type: 'human' as const,
      owner: null as string | null
    }
  }

  if (entity.type === 'oracle') {
    return {
      displayName: entity.oracle_name || entity.name,
      label: 'Oracle' as const,
      type: 'oracle' as const,
      owner: entity.owner_github || null
    }
  }

  if (entity.type === 'unverified_oracle') {
    return {
      displayName: entity.oracle_name || entity.name,
      label: 'Unverified' as const,
      type: 'unverified_oracle' as const,
      owner: entity.owner_github || null
    }
  }

  if (entity.type === 'agent') {
    return {
      displayName: entity.display_name || entity.name,
      label: 'Agent' as const,
      type: 'agent' as const,
      owner: null as string | null
    }
  }

  // Fallback: Oracle = has birth_issue (AI agent) - ALWAYS shows Oracle badge
  // human is set when claimed by a human (via expand.human)
  if (entity.birth_issue) {
    const ownerName = entity.expand?.human?.github_username || null
    return {
      displayName: entity.oracle_name || entity.name,  // Prefer oracle_name over name
      label: 'Oracle' as const,
      type: 'oracle' as const,
      owner: entity.claimed && ownerName ? ownerName : null
    }
  }

  // Otherwise, just show name
  return { displayName: entity.name, label: null, type: 'wallet' as const, owner: null as string | null }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

// Convert wallet address to EIP-55 checksummed format (mixed case)
export function checksumAddress(address: string | null | undefined): string | null {
  if (!address) return null
  try {
    return getAddress(address)
  } catch {
    return address
  }
}

export function formatBirthDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  // Output: "Jan 31, 2026"
}
