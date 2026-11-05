import { create } from 'zustand'
import { PERSONAS, type Persona } from '@/data/fixtures/graduates'

export type { Persona }

function initialId(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('persona')
    if (q && PERSONAS.some((p) => p.id === q)) return q
  } catch {
    /* no window */
  }
  return 'grad-m-gold'
}

const useSessionStore = create<{ personaId: string; setPersona(id: string): void }>((set) => ({
  personaId: initialId(),
  setPersona: (personaId) => set({ personaId }),
}))

export function useSession(): { persona: Persona; setPersona(id: string): void } {
  const personaId = useSessionStore((s) => s.personaId)
  const setPersona = useSessionStore((s) => s.setPersona)
  const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]
  return { persona, setPersona }
}
