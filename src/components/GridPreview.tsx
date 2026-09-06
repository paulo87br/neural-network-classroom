import { useEffect, useRef } from 'react'

export function GridPreview({ pixels, className = '' }: { pixels: Float32Array; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const image = context.createImageData(32, 32)
    pixels.forEach((value, index) => {
      const intensity = Math.round(Math.max(0, Math.min(1, value)) * 255)
      image.data[index * 4] = 103
      image.data[index * 4 + 1] = Math.min(255, intensity + 50)
      image.data[index * 4 + 2] = 255
      image.data[index * 4 + 3] = intensity
    })
    context.clearRect(0, 0, 32, 32)
    context.putImageData(image, 0, 0)
  }, [pixels])

  return <canvas ref={canvasRef} width={32} height={32} className={`grid-preview ${className}`} aria-label="Matriz de entrada desenhada" />
}
