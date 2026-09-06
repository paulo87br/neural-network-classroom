export const GRID_SIZE = 32

export function clearDrawing(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.save()
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
}

export function canvasToGrid(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return new Float32Array(GRID_SIZE * GRID_SIZE)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4
      if (image.data[offset] > 20) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < minX || maxY < minY) return new Float32Array(GRID_SIZE * GRID_SIZE)

  const normalized = document.createElement('canvas')
  normalized.width = GRID_SIZE
  normalized.height = GRID_SIZE
  const normalizedContext = normalized.getContext('2d', { willReadFrequently: true })!
  normalizedContext.fillStyle = '#000'
  normalizedContext.fillRect(0, 0, GRID_SIZE, GRID_SIZE)
  const sourceWidth = maxX - minX + 1
  const sourceHeight = maxY - minY + 1
  const scale = Math.min(22 / sourceWidth, 22 / sourceHeight)
  const targetWidth = sourceWidth * scale
  const targetHeight = sourceHeight * scale
  normalizedContext.imageSmoothingEnabled = true
  normalizedContext.drawImage(
    canvas,
    minX,
    minY,
    sourceWidth,
    sourceHeight,
    (GRID_SIZE - targetWidth) / 2,
    (GRID_SIZE - targetHeight) / 2,
    targetWidth,
    targetHeight,
  )

  const output = normalizedContext.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data
  return Float32Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => output[index * 4] / 255)
}

export function encodeGrid(grid: Float32Array) {
  return Array.from(grid, (value) => Math.round(Math.max(0, Math.min(1, value)) * 255))
}

export function decodeGrid(values: number[]) {
  if (!Array.isArray(values) || values.length !== GRID_SIZE * GRID_SIZE) return new Float32Array(GRID_SIZE * GRID_SIZE)
  return Float32Array.from(values, (value) => Math.max(0, Math.min(255, Number(value) || 0)) / 255)
}

export function makeDemoDigit(digit: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  clearDrawing(canvas)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fff'
  context.font = '700 190px Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(digit), 128, 139)
  return canvasToGrid(canvas)
}
