import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Moon, RotateCcw, Sun } from 'lucide-react'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { BrandSignature } from '../components/BrandSignature'
import { GridPreview } from '../components/GridPreview'
import { NetworkScene, type DisplayTheme } from '../components/NetworkScene'
import { decodeGrid } from '../lib/grid'
import { loadClassroomModel, type InferenceResult, type LayerActivation } from '../lib/model'
import { ClassroomBus, type ConnectionState } from '../lib/realtime'

const blank = new Float32Array(32 * 32)
const stageLabels = ['Entrada', 'Conv 1', 'Conv 2', 'Conv 3', 'Conv 4', 'Flatten', 'Densa', 'Saída']
const stageExplanations = [
  'O desenho entra como uma grade de 1.024 intensidades.',
  'Filtros procuram traços simples, como bordas e pequenas curvas.',
  'Os sinais anteriores são combinados para formar padrões maiores.',
  'A rede preserva combinações que ajudam a distinguir os algarismos.',
  'A última convolução concentra os padrões mais úteis para a decisão.',
  'Os mapas são reorganizados em um único vetor, sem alterar os valores.',
  'Cada posição do vetor contribui com pesos diferentes para as dez opções.',
  'Softmax transforma as dez notas em probabilidades que somam 100%.',
] as const

function summarizeLayer(layer: LayerActivation) {
  const values = Array.from(layer.values)
  const positive = values.filter((value) => value > 0).length
  const strongest = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0)
  const shape = layer.shape[0] === 1 && layer.shape[1] === 1
    ? `vetor [${layer.shape[2]}]`
    : layer.shape.join(' × ')
  return { positive, strongest, shape, total: values.length }
}

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
  const [theme, setTheme] = useState<DisplayTheme>(() => {
    const saved = window.localStorage.getItem('cnn3d-display-theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    window.localStorage.setItem('cnn3d-display-theme', theme)
  }, [theme])

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
  const observedLayer = result && activeStage >= 0 ? result.layers[activeStage] : null
  const layerSummary = observedLayer ? summarizeLayer(observedLayer) : null

  return (
    <main className={`display-page is-${theme}`}>
      <NetworkScene layers={layers} runId={runId} viewResetId={viewResetId} activeStage={activeStage} theme={theme} />
      <header className="display-header">
        <div>
          <BrandSignature compact />
          <span className="eyebrow">Rede neural convolucional · Sala {room}</span>
          <h1>Como uma máquina enxerga?</h1>
        </div>
        <div className="display-header-actions">
          <ConnectionBadge state={connection} />
          <button
            className="icon-button"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
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
        {observedLayer && activeStage < stageLabels.length - 1 && layerSummary ? <div className="layer-copy">
          <span className="eyebrow">O que esta etapa produziu</span>
          <h2>{observedLayer.label}</h2>
          <p>{stageExplanations[activeStage]}</p>
          <div className="layer-facts">
            <span><small>Formato da saída</small><strong>{layerSummary.shape}</strong></span>
            <span><small>Sinais positivos</small><strong>{layerSummary.positive} de {layerSummary.total}</strong></span>
            <span><small>Maior intensidade</small><strong>{layerSummary.strongest.toFixed(2)}</strong></span>
          </div>
        </div> : <div className="result-copy">
          <span className="eyebrow">Resultado</span>
          <strong>{result ? result.prediction : '—'}</strong>
          <p>{status}</p>
        </div>}
        <div className={`probability-list ${activeStage < stageLabels.length - 1 ? 'is-secondary' : ''}`}>
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
