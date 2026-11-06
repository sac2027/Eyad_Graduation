import type { HonorTier } from '@/domain/types'
import { honorTier } from '@/domain/honorTier'
import { PERSONAS } from '../fixtures/graduates'

export const honorService = {
  get(userId: string): { tier: HonorTier | null; gpa: number } {
    const p = PERSONAS.find((x) => x.id === userId)
    if (!p || p.role !== 'graduate') return { tier: null, gpa: 0 }
    return { tier: honorTier(p.gpa), gpa: p.gpa }
  },
}
