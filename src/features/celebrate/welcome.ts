import { sessionStore, shouldCelebrate } from './gate'

let decided: boolean | null = null

/**
 * Whether this page load opens with the welcome moment: once per session. Automated browsers skip it
 * (so tests see the page itself) unless the URL asks for it with ?welcome=1; ?welcome=0 always skips it.
 */
export function welcomeThisVisit(): boolean {
  if (decided !== null) return decided
  let q: string | null = null
  try {
    q = new URLSearchParams(window.location.search).get('welcome')
  } catch {
    /* no window */
  }
  const automated = typeof navigator !== 'undefined' && navigator.webdriver
  decided = q !== '0' && (!automated || q === '1') && shouldCelebrate('welcome', 'landing', sessionStore())
  return decided
}
