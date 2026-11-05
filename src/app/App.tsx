import { useEffect } from 'react'

export function App() {
  useEffect(() => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
  }, [])
  return <main className="p-6 font-display text-2xl text-turquoise">KFUPM</main>
}
