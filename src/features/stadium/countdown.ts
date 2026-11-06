/** Whole days, hours, minutes and seconds until the target (all zero once it has passed). */
export function countdownParts(now: number, target: number): { days: number; h: number; m: number; s: number; done: boolean } {
  const left = Math.max(0, target - now)
  const sec = Math.floor(left / 1000)
  return {
    days: Math.floor(sec / 86_400),
    h: Math.floor((sec % 86_400) / 3600),
    m: Math.floor((sec % 3600) / 60),
    s: sec % 60,
    done: left === 0,
  }
}
