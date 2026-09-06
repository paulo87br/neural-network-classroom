import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Eraser, ExternalLink, Lock, Play, RotateCcw, Unlock } from 'lucide-react'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { encodeGrid, makeDemoDigit } from '../lib/grid'
import { ClassroomBus, type ConnectionState } from '../lib/realtime'

export function TeacherPage({ room }: { room: string }) {
  const busRef = useRef<ClassroomBus | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [locked, setLocked] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const inputUrl = useMemo(() => `${window.location.origin}/input?room=${encodeURIComponent(room)}`, [room])
  const displayUrl = useMemo(() => `${window.location.origin}/display?room=${encodeURIComponent(room)}`, [room])

  useEffect(() => {
    const bus = new ClassroomBus(room, 'professor')
    busRef.current = bus
    bus.connect(setConnection)
    void QRCode.toDataURL(inputUrl, { width: 320, margin: 1, color: { dark: '#07111d', light: '#ffffff' } }).then(setQrCode)
    return () => bus.disconnect()
  }, [inputUrl, room])

  const sendDemo = async (digit: number) => {
    const pixels = encodeGrid(makeDemoDigit(digit))
    await busRef.current?.send('frame', { pixels })
    await busRef.current?.send('process', { pixels })
  }

  const toggleLock = async () => {
    const next = !locked
    setLocked(next)
    await busRef.current?.send('lock', { locked: next })
  }

  return (
    <main className="teacher-page">
      <header className="compact-header teacher-header">
        <div>
          <span className="eyebrow">Painel do professor</span>
          <h1>Sala {room}</h1>
        </div>
        <ConnectionBadge state={connection} />
      </header>

      <div className="teacher-grid">
        <section className="teacher-card qr-card">
          <div>
            <span className="section-number">01</span>
            <h2>Conectar o tablet</h2>
            <p>Abra a câmera do tablet e aponte para o código.</p>
          </div>
          {qrCode && <img src={qrCode} alt={`QR Code para abrir a entrada da sala ${room}`} />}
          <button className="text-button" onClick={() => void navigator.clipboard.writeText(inputUrl)}><Copy size={17} /> Copiar link</button>
        </section>

        <section className="teacher-card">
          <span className="section-number">02</span>
          <h2>Preparar a projeção</h2>
          <p>Abra a visualização em outra aba, mova-a para o projetor e pressione F para tela cheia.</p>
          <a className="button button-primary" href={displayUrl} target="_blank" rel="noreferrer"><ExternalLink size={19} /> Abrir projeção</a>
        </section>

        <section className="teacher-card controls-card">
          <span className="section-number">03</span>
          <h2>Controlar a atividade</h2>
          <div className="teacher-actions">
            <button className="button button-secondary" onClick={() => void busRef.current?.send('clear')}><Eraser size={19} /> Limpar tudo</button>
            <button className="button button-secondary" onClick={() => void busRef.current?.send('replay')}><RotateCcw size={19} /> Repetir</button>
            <button className={`button ${locked ? 'button-warning' : 'button-secondary'}`} onClick={() => void toggleLock()}>
              {locked ? <Unlock size={19} /> : <Lock size={19} />}{locked ? 'Liberar tablet' : 'Bloquear tablet'}
            </button>
          </div>
        </section>

        <section className="teacher-card demo-card">
          <span className="section-number">04</span>
          <h2>Plano B</h2>
          <p>Use um exemplo pronto se precisar demonstrar sem o tablet.</p>
          <div className="digit-buttons">
            {Array.from({ length: 10 }, (_, digit) => <button key={digit} onClick={() => void sendDemo(digit)}>{digit}</button>)}
          </div>
          <div className="demo-note"><Play size={15} fill="currentColor" /> Cada número inicia a animação imediatamente.</div>
        </section>
      </div>
    </main>
  )
}
