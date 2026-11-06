import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { err, ok, type Result } from '@/domain/types'

export interface Exception {
  id: string
  name: string
  reason: string
}

export function createAdminService() {
  const store = createStore<{ exceptions: Exception[] }>(() => ({
    exceptions: [{ id: '202000123', name: 'Mock: international student leaving before the ceremony', reason: 'Attends the ceremony, not a candidate' }],
  }))
  const initial = store.getState().exceptions
  return {
    store,
    /** Demo only: back to the starting list. */
    reset() {
      store.setState({ exceptions: initial })
    },
    list: () => store.getState().exceptions,
    addException(e: Exception): Result<Exception, 'invalid' | 'duplicate'> {
      const id = e.id.trim()
      const name = e.name.trim()
      if (!/^\d{6,12}$/.test(id) || name.length === 0) return err('invalid')
      if (store.getState().exceptions.some((x) => x.id === id)) return err('duplicate')
      const rec = { id, name, reason: e.reason.trim() }
      store.setState((s) => ({ exceptions: [rec, ...s.exceptions] }))
      return ok(rec)
    },
  }
}

export type AdminService = ReturnType<typeof createAdminService>
export const adminService = createAdminService()
export function useExceptions(service: AdminService = adminService): Exception[] {
  return useStore(service.store, (s) => s.exceptions)
}
