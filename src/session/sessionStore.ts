import { create } from 'zustand'
import { PERSONAS, type Persona } from '@/data/fixtures/graduates'
import { useDemoFlags } from '@/features/demo-console/flags'

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

export const useSessionStore = create<{ personaId: string; setPersona(id: string): void }>((set) => ({
  personaId: initialId(),
  setPersona: (personaId) => set({ personaId }),
}))

const WORST_CASE_NAME = {
  ar: 'عبدالرحمن بن محمد بن عبدالعزيز بن سعود بن فيصل آل سعود الغامدي الشمري',
  en: 'Abdulrahman bin Mohammed bin Abdulaziz bin Saud bin Faisal Al-Ghamdi Al-Shammari',
}

export function useSession(): { persona: Persona; setPersona(id: string): void } {
  const personaId = useSessionStore((s) => s.personaId)
  const setPersona = useSessionStore((s) => s.setPersona)
  const gpaOverride = useDemoFlags((s) => s.gpaOverride)
  const worst = useDemoFlags((s) => s.worstCase)
  let persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0]
  if (persona.role === 'graduate') {
    persona = { ...persona, gpa: gpaOverride ?? persona.gpa, name: worst ? WORST_CASE_NAME : persona.name }
  }
  return { persona, setPersona }
}
