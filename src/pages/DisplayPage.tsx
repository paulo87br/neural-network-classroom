import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, RotateCcw } from 'lucide-react'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { BrandSignature } from '../components/BrandSignature'
import { GridPreview } from '../components/GridPreview'
import { NetworkScene } from '../components/NetworkScene'
import { decodeGrid } from '../lib/grid'
import { loadClassroomModel, type InferenceResult, type LayerActivation } from '../lib/model'
import { ClassroomBus, type ConnectionState } from '../lib/realtime'

const blank = new Float32Array(32 * 32)
const stageLabels = ['Entrada', 'Conv 1', 'Conv 2', 'Conv 3', 'Conv 4', 'Flatten', 'Densa', 'Saída']

function blankLayers(pixels: Float32Array): LayerActivation[] {
  return [{ id: 'input', label: 'Entrada 32×32', shape: [1, 32, 32], values: pixels }]
}

export function DisplayPage({ room }: { room: string }) {
  const busRef = useRef<ClassroomBus | null>(null)
  const lastResultRef = useRef<InferenceResult | null>(null)
  const pixelsRef = useRef<Float32Array>(blank)
  const stageTimerRef = useRef<number | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [pixels, setPixels] = useState<Float32Array>(blank)
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [runId, setRunId] = useState(0)
  const [viewResetId, setViewResetId] = useState(0)
  const [activeStage, setActiveStage] = useState(-1)
  const [status, setStatus] = useState('Aguardando um desenho no tablet')

  const stopStagePlayback = useCallback(() => {
    if (!stageTimerRef.current) return
    window.clearInterval(stageTimerRef.current)
    stageTimerRef.current = null
  }, [])

  const selectStage = useCallback((index: number) => {
    const currentResult = lastResultRef.current
    if (!currentResult) return
    stopStagePlayback()
    const next = Math.max(0, Math.min(stageLabels.length - 1, index))
    setActiveStage(next)
    setStatus(next === stageLabels.length - 1
      ? `A rede reconheceu o número ${currentResult.prediction}`
      : `Explorando: ${stageLabels[next]}`)
  }, [stopStagePlayback])

  const runInference = useCallback(async (nextPixels?: Float32Array) => {
    const input = nextPixels || pixelsRef.current
    setStatus('Processando a rede neural…')
    setActiveStage(0)
    try {
      const model = await loadClassroomModel()
      const nextResult = model.infer(input)
      lastResultRef.current = nextResult
      setResult(nextResult)
      setRunId((value) => value + 1)
      stopStagePlayback()
      let stage = 0
      stageTimerRef.current = window.setInterval(() => {
        stage += 1
        setActiveStage(stage)
        if (stage >= 7) {
          if (stageTimerRef.current) window.clearInterval(stageTimerRef.current)
          stageTimerRef.current = null
          setStatus(`A rede reconheceu o número ${nextResult.prediction}`)
        }
      }, 720)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível carregar o modelo.')
    }
  }, [stopStagePlayback])

  useEffect(() => {
    void loadClassroomModel().catch(() => undefined)
    const bus = new ClassroomBus(room, 'projetor')
    busRef.current = bus
    bus.on('frame', ({ pixels: values }) => {
      if (!Array.isArray(values)) return
      const next = decodeGrid(values as number[])
      pixelsRef.current = next
      setPixels(next)
      if (!lastResultRef.current) setResult(null)
      setStatus('Desenho recebido — aguardando processamento')
    })
    bus.on('process', ({ pixels: values }) => {
      const next = Array.isArray(values) ? decodeGrid(values as number[]) : undefined
      if (next) {
        pixelsRef.current = next
        setPixels(next)
      }
      void runInference(next)
    })
    bus.on('replay', () => {
      if (lastResultRef.current) {
        void runInference(lastResultRef.current.layers[0].values)
      }
    })
    bus.on('clear', () => {
      pixelsRef.current = blank
      setPixels(blank)
      setResult(null)
      lastResultRef.current = null
      setActiveStage(-1)
      setStatus('Aguardando um desenho no tablet')
    })
    bus.connect(setConnection)
    return () => {
      bus.disconnect()
      if (stageTimerRef.current) window.clearInterval(stageTimerRef.current)
    }
  }, [room, runInference])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && pixels.some((value) => value > 0)) void runInference()
      if (event.key === ' ') {
        event.preventDefault()
        void busRef.current?.send('clear')
        pixelsRef.current = blank
        setPixels(blank)
        setResult(null)
      }
      if (event.key.toLowerCase() === 'f') void document.documentElement.requestFullscreen()
      if (event.key.toLowerCase() === 'r') setViewResetId((value) => value + 1)
      if (event.key === 'ArrowLeft') selectStage(activeStage - 1)
      if (event.key === 'ArrowRight') selectStage(activeStage + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeStage, pixels, runInference, selectStage])

  const layers = useMemo(() => result?.layers || blankLayers(pixels), [pixels, result])

  return (
    <main className="display-page">
      <NetworkScene layers={layers} runId={runId} viewResetId={viewResetId} activeStage={activeStage} />
      <header className="display-header">
        <div>
          <BrandSignature compact />
          <span className="eyebrow">Rede neural convolucional · Sala {room}</span>
          <h1>Como uma máquina enxerga?</h1>
        </div>
        <div className="display-header-actions">
          <ConnectionBadge state={connection} />
          <button className="icon-button" onClick={() => setViewResetId((value) => value + 1)} aria-label="Restaurar posição da câmera" title="Restaurar câmera">
            <RotateCcw size={20} />
          </button>
          <button className="icon-button" onClick={() => void document.documentElement.requestFullscreen()} aria-label="Entrar em tela cheia">
            <Maximize size={20} />
          </button>
        </div>
      </header>

      <section className="input-monitor">
        <span>Entrada do aluno</span>
        <GridPreview pixels={pixels} />
      </section>

      <section className="result-panel" aria-live="polite">
        <div className="result-copy">
          <span className="eyebrow">Resultado</span>
          <strong>{result ? result.prediction : '—'}</strong>
          <p>{status}</p>
        </div>
        <div className="probability-list">
          {Array.from({ length: 10 }, (_, number) => {
            const probability = result?.probabilities[number] || 0
            return (
              <div className={`probability-row ${result?.prediction === number ? 'is-winner' : ''}`} key={number}>
                <span>{number}</span>
                <div><i style={{ width: `${Math.max(1, probability * 100)}%` }} /></div>
                <b>{Math.round(probability * 100)}%</b>
              </div>
            )
          })}
        </div>
      </section>

      <div className="scene-controls-hint" aria-hidden="true">
        Arraste para girar <span>·</span> Roda ou pinça para zoom <span>·</span> Botão direito para mover
      </div>

      <footer className="stage-timeline">
        <div className="timeline-steps" aria-label="Etapas da rede neural">
          {stageLabels.map((label, index) => (
            <button
              type="button"
              className={`stage-step ${index <= activeStage ? 'is-reached' : ''} ${index === activeStage ? 'is-current' : ''}`}
              key={label}
              onClick={() => selectStage(index)}
              disabled={!result}
              aria-current={index === activeStage ? 'step' : undefined}
              title={`Ir para ${label}`}
            >
              <span>{index + 1}</span><b>{label}</b>
            </button>
          ))}
        </div>
        <div className="timeline-nav">
          <button className="timeline-button" onClick={() => selectStage(activeStage - 1)} disabled={!result || activeStage <= 0} aria-label="Etapa anterior" title="Etapa anterior">
            <ChevronLeft size={18} />
          </button>
          <button className="timeline-button" onClick={() => selectStage(activeStage + 1)} disabled={!result || activeStage >= stageLabels.length - 1} aria-label="Próxima etapa" title="Próxima etapa">
            <ChevronRight size={18} />
          </button>
          <button className="replay-button" onClick={() => void runInference()} disabled={!pixels.some((value) => value > 0)}>
            <RotateCcw size={16} /> Repetir
          </button>
        </div>
      </footer>
    </main>
  )
}
