import { BrowserRouter } from 'react-router-dom'
import { useLocale } from '@/i18n'
import { AppRoutes } from './routes'

export function App() {
  useLocale() // keeps <html lang dir> in sync
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
