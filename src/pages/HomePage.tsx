import { useState } from 'react'
import { ArrowRight, MonitorUp, Presentation, Tablet } from 'lucide-react'
import { sanitizeRoom } from '../lib/realtime'

export function HomePage() {
  const [room, setRoom] = useState(() => sanitizeRoom(localStorage.getItem('nn-room')))
  const updateRoom = (value: string) => {
    const next = sanitizeRoom(value)
    setRoom(next)
    localStorage.setItem('nn-room', next)
  }

  return (
    <main className="home-page">
      <section className="launcher">
        <div className="launcher-title">
          <div className="network-mark"><i /><i /><i /><i /><i /></div>
          <span className="eyebrow">Experimento interativo</span>
          <h1>Rede Neural<br />ao Vivo</h1>
          <p>Desenhe um número e acompanhe cada transformação até a decisão da máquina.</p>
        </div>

        <div className="room-setup">
          <label htmlFor="room">Código da sala</label>
          <input id="room" value={room} onChange={(event) => updateRoom(event.target.value)} maxLength={24} />
          <div className="route-cards">
            <a href={`/teacher?room=${room}`} className="route-card route-primary">
              <Presentation size={26} /><span><b>Painel do professor</b><small>Comece por aqui</small></span><ArrowRight />
            </a>
            <a href={`/display?room=${room}`} className="route-card">
              <MonitorUp size={25} /><span><b>Tela do projetor</b><small>Visualização 3D</small></span><ArrowRight />
            </a>
            <a href={`/input?room=${room}`} className="route-card">
              <Tablet size={25} /><span><b>Tela do tablet</b><small>Área de desenho</small></span><ArrowRight />
            </a>
          </div>
        </div>
      </section>
      <footer className="home-footer">Baseado no projeto CNN Visualization de Kim Seonghyun · Uso educacional</footer>
    </main>
  )
}
