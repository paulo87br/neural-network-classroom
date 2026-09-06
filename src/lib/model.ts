export type LayerActivation = {
  id: string
  label: string
  shape: [number, number, number]
  values: Float32Array
}

export type InferenceResult = {
  layers: LayerActivation[]
  probabilities: number[]
  prediction: number
}

type ConvLayer = {
  outChannels: number
  inChannels: number
  kernelHeight: number
  kernelWidth: number
  weights: Float32Array
  bias: Float32Array
}

type DenseLayer = {
  outputSize: number
  inputSize: number
  weights: Float32Array
  bias: Float32Array
  relu: boolean
}

const MODEL_FILES = [
  'conv1Weight.txt', 'conv1Bias.txt',
  'conv2Weight.txt', 'conv2Bias.txt',
  'conv3Weight.txt', 'conv3Bias.txt',
  'conv4Weight.txt', 'conv4Bias.txt',
  'mlp1Weight.txt', 'mlp1Bias.txt',
  'mlp2Weight.txt', 'mlp2Bias.txt',
] as const

let modelPromise: Promise<ClassroomModel> | null = null

function lines(text: string) {
  return text.trim().split(/\r?\n/).filter(Boolean)
}

function parseVector(text: string) {
  return Float32Array.from(lines(text).map(Number))
}

function parseConv(weightText: string, biasText: string): ConvLayer {
  const rows = lines(weightText)
  const channels = rows[0].split('!')
  const kernelRows = channels[0].split(',')
  const kernelCols = kernelRows[0].trim().split(/\s+/)
  const values: number[] = []

  for (const outputChannel of rows) {
    for (const inputChannel of outputChannel.split('!')) {
      for (const row of inputChannel.split(',')) {
        values.push(...row.trim().split(/\s+/).map(Number))
      }
    }
  }

  return {
    outChannels: rows.length,
    inChannels: channels.length,
    kernelHeight: kernelRows.length,
    kernelWidth: kernelCols.length,
    weights: Float32Array.from(values),
    bias: parseVector(biasText),
  }
}

function parseDense(weightText: string, biasText: string, relu: boolean): DenseLayer {
  const rows = lines(weightText).map((row) => row.trim().split(/\s+/).map(Number))
  return {
    outputSize: rows.length,
    inputSize: rows[0].length,
    weights: Float32Array.from(rows.flat()),
    bias: parseVector(biasText),
    relu,
  }
}

function convolve(
  input: Float32Array,
  shape: [number, number, number],
  layer: ConvLayer,
) {
  const [inChannels, height, width] = shape
  const stride = 2
  const padding = 1
  const outHeight = Math.floor((height + padding * 2 - layer.kernelHeight) / stride) + 1
  const outWidth = Math.floor((width + padding * 2 - layer.kernelWidth) / stride) + 1
  const output = new Float32Array(layer.outChannels * outHeight * outWidth)

  for (let oc = 0; oc < layer.outChannels; oc += 1) {
    for (let oy = 0; oy < outHeight; oy += 1) {
      for (let ox = 0; ox < outWidth; ox += 1) {
        let sum = layer.bias[oc]
        for (let ic = 0; ic < inChannels; ic += 1) {
          for (let ky = 0; ky < layer.kernelHeight; ky += 1) {
            for (let kx = 0; kx < layer.kernelWidth; kx += 1) {
              const iy = oy * stride + ky - padding
              const ix = ox * stride + kx - padding
              if (iy < 0 || ix < 0 || iy >= height || ix >= width) continue
              const inputIndex = ic * height * width + iy * width + ix
              const weightIndex = (((oc * layer.inChannels + ic) * layer.kernelHeight + ky) * layer.kernelWidth) + kx
              sum += input[inputIndex] * layer.weights[weightIndex]
            }
          }
        }
        output[oc * outHeight * outWidth + oy * outWidth + ox] = Math.max(0, sum)
      }
    }
  }

  return { values: output, shape: [layer.outChannels, outHeight, outWidth] as [number, number, number] }
}

function dense(input: Float32Array, layer: DenseLayer) {
  const output = new Float32Array(layer.outputSize)
  for (let row = 0; row < layer.outputSize; row += 1) {
    let sum = layer.bias[row]
    const offset = row * layer.inputSize
    for (let col = 0; col < layer.inputSize; col += 1) sum += layer.weights[offset + col] * input[col]
    output[row] = layer.relu ? Math.max(0, sum) : sum
  }
  return output
}

function softmax(logits: Float32Array) {
  const max = Math.max(...logits)
  const exp = Array.from(logits, (value) => Math.exp(value - max))
  const total = exp.reduce((sum, value) => sum + value, 0)
  return exp.map((value) => value / total)
}

class ClassroomModel {
  constructor(
    private readonly convLayers: ConvLayer[],
    private readonly denseLayers: DenseLayer[],
  ) {}

  infer(pixels: Float32Array): InferenceResult {
    const layers: LayerActivation[] = [{ id: 'input', label: 'Entrada 32×32', shape: [1, 32, 32], values: pixels }]
    let current = { values: pixels, shape: [1, 32, 32] as [number, number, number] }

    this.convLayers.forEach((layer, index) => {
      current = convolve(current.values, current.shape, layer)
      layers.push({
        id: `conv-${index + 1}`,
        label: `Convolução ${index + 1}`,
        shape: current.shape,
        values: current.values,
      })
    })

    const flattened = new Float32Array(current.values)
    layers.push({ id: 'flatten', label: 'Flatten', shape: [1, 1, flattened.length], values: flattened })
    const hidden = dense(flattened, this.denseLayers[0])
    layers.push({ id: 'dense', label: 'Camada densa', shape: [1, 1, hidden.length], values: hidden })
    const logits = dense(hidden, this.denseLayers[1])
    const probabilities = softmax(logits)
    layers.push({ id: 'output', label: 'Probabilidades', shape: [1, 1, 10], values: Float32Array.from(probabilities) })

    let prediction = 0
    probabilities.forEach((value, index) => {
      if (value > probabilities[prediction]) prediction = index
    })
    return { layers, probabilities, prediction }
  }
}

export function loadClassroomModel() {
  if (modelPromise) return modelPromise
  modelPromise = (async () => {
    const base = `${import.meta.env.BASE_URL}model/`
    const responses = await Promise.all(MODEL_FILES.map((file) => fetch(`${base}${file}`)))
    const failed = responses.find((response) => !response.ok)
    if (failed) throw new Error(`Não foi possível carregar o modelo (${failed.status}).`)
    const text = await Promise.all(responses.map((response) => response.text()))
    return new ClassroomModel(
      [
        parseConv(text[0], text[1]),
        parseConv(text[2], text[3]),
        parseConv(text[4], text[5]),
        parseConv(text[6], text[7]),
      ],
      [parseDense(text[8], text[9], true), parseDense(text[10], text[11], false)],
    )
  })()
  return modelPromise
}
