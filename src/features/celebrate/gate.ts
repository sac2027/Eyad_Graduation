import type { CelebrationKind } from './celebrate'

type Store = Pick<Storage, 'getItem' | 'setItem'> | null

/** Remembered in memory when session storage is missing or blocked, so a celebration still plays at most once per page load. */
const seen = new Set<string>()

/** True the first time a celebration is asked for in this session, false after that. */
export function shouldCelebrate(kind: CelebrationKind, key: string, storage: Store): boolean {
  const id = `celebrated:${kind}:${key}`
  if (seen.has(id)) return false
  seen.add(id)
  try {
    if (!storage) return true
    if (storage.getItem(id)) return false
    storage.setItem(id, '1')
  } catch {
    /* blocked storage: the in-memory set decides */
  }
  return true
}

export function sessionStore(): Store {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
