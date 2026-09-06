import { lazy, Suspense } from 'react'
import { AuthGate } from './components/AuthGate'
import { sanitizeRoom } from './lib/realtime'

const DisplayPage = lazy(() => import('./pages/DisplayPage').then((module) => ({ default: module.DisplayPage })))
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const InputPage = lazy(() => import('./pages/InputPage').then((module) => ({ default: module.InputPage })))
const TeacherPage = lazy(() => import('./pages/TeacherPage').then((module) => ({ default: module.TeacherPage })))

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  const room = sanitizeRoom(params.get('room') || localStorage.getItem('nn-room'))
  localStorage.setItem('nn-room', room)

  let page = <HomePage />
  if (path === '/display') page = <DisplayPage room={room} />
  if (path === '/input') page = <InputPage room={room} />
  if (path === '/teacher') page = <TeacherPage room={room} />
  return (
    <AuthGate>
      <Suspense fallback={<div className="route-loading">Carregando experiência…</div>}>{page}</Suspense>
    </AuthGate>
  )
}
