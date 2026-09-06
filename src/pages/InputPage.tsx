import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Play, Radio, Send } from 'lucide-react'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { canvasToGrid, clearDrawing, encodeGrid } from '../lib/grid'
import { ClassroomBus, type ConnectionState } from '../lib/realtime'

export function InputPage({ room }: { room: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const busRef = useRef<ClassroomBus | null>(null)
  const lastSendRef = useRef(0)
  const drawingRef = useRef(false)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [locked, setLocked] = useState(false)
  const [feedback, setFeedback] = useState('Desenhe um número de 0 a 9')

  const sendFrame = useCallback(async (force = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const now = performance.now()
    if (!force && now - lastSendRef.current < 90) return
    lastSendRef.current = now
    await busRef.current?.send('frame', { pixels: encodeGrid(canvasToGrid(canvas)) })
  }, [])

  const reset = useCallback(async (broadcast = true) => {
    if (canvasRef.current) clearDrawing(canvasRef.current)
    setFeedback('Desenhe um número de 0 a 9')
    if (broadcast) await busRef.current?.send('clear')
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) clearDrawing(canvas)
    const bus = new ClassroomBus(room, 'tablet')
    busRef.current = bus
    bus.on('clear', () => void reset(false))
    bus.on('lock', ({ locked: nextLocked }) => setLocked(Boolean(nextLocked)))
    bus.connect(setConnection)
    return () => bus.disconnect()
  }, [reset, room])

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    }
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked) return
    drawingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const context = event.currentTarget.getContext('2d')!
    const point = pointerPosition(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || locked) return
    const context = event.currentTarget.getContext('2d')!
    const point = pointerPosition(event)
    context.strokeStyle = '#fff'
    context.lineWidth = 24
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineTo(point.x, point.y)
    context.stroke()
    void sendFrame()
  }

  const stopDrawing = () => {
    drawingRef.current = false
    void sendFrame(true)
  }

  const process = async () => {
    const canvas = canvasRef.current
    if (!canvas || locked) return
    const grid = canvasToGrid(canvas)
    if (!grid.some((value) => value > 0.04)) {
      setFeedback('Faça um desenho antes de processar')
      return
    }
    const pixels = encodeGrid(grid)
    await busRef.current?.send('frame', { pixels })
    await busRef.current?.send('process', { pixels })
    setFeedback('Enviado! Observe a projeção')
  }

  return (
    <main className="input-page">
      <header className="compact-header">
        <div>
          <span className="eyebrow">Sala {room}</span>
          <h1>Desenhe um número</h1>
        </div>
        <ConnectionBadge state={connection} />
      </header>

      <section className={`drawing-card ${locked ? 'is-locked' : ''}`}>
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="drawing-canvas"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          aria-label="Área para desenhar um número"
        />
        {locked && <div className="canvas-lock"><Radio size={28} /> Aguarde o professor</div>}
      </section>

      <p className="input-feedback" role="status">{feedback}</p>
      <div className="input-actions">
        <button className="button button-secondary" onClick={() => void reset()} disabled={locked}>
          <Eraser size={20} /> Limpar
        </button>
        <button className="button button-primary" onClick={() => void process()} disabled={locked}>
          <Play size={22} fill="currentColor" /> Processar
        </button>
      </div>
      <div className="student-handoff"><Send size={18} /> Depois, entregue o tablet ao próximo aluno.</div>
    </main>
  )
}
