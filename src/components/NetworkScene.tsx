import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { LayerActivation } from '../lib/model'

type LayerVisual = {
  group: THREE.Group
  material: THREE.MeshBasicMaterial
  baseX: number
}

const layerPositions = [-6.5, -4.7, -3.1, -1.6, -0.2, 1.5, 3.2, 5.1]

function activationColor(value: number, max: number, isOutput: boolean) {
  const amount = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  if (isOutput) return new THREE.Color().setHSL(0.105, 0.72, 0.12 + amount * 0.57)
  return new THREE.Color(
    0.08 + amount * 0.72,
    0.1 + amount * 0.45,
    0.14 + amount * 0.16,
  )
}

function buildLayer(layer: LayerActivation, layerIndex: number): LayerVisual {
  const [channels, height, width] = layer.shape
  const isVector = height === 1
  const isOutput = layer.id === 'output'
  const group = new THREE.Group()
  group.position.x = layerPositions[layerIndex]
  const count = layer.values.length
  const cubeSize = isVector ? (isOutput ? 0.28 : 0.11) : Math.max(0.055, Math.min(0.15, 2.8 / Math.max(height, width)))
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13 })
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
  const matrix = new THREE.Matrix4()
  const max = Math.max(...layer.values, 0.00001)

  for (let index = 0; index < count; index += 1) {
    let x = 0
    let y = 0
    let z = 0
    if (isVector) {
      const span = isOutput ? 3.5 : 4.8
      y = count === 1 ? 0 : (index / (count - 1) - 0.5) * span
    } else {
      const channelSize = height * width
      const channel = Math.floor(index / channelSize)
      const within = index % channelSize
      const row = Math.floor(within / width)
      const column = within % width
      y = height === 1 ? 0 : (0.5 - row / (height - 1)) * 3.4
      z = width === 1 ? 0 : (column / (width - 1) - 0.5) * 3.4
      x = channels === 1 ? 0 : (channel / (channels - 1) - 0.5) * 0.75
    }
    const valueScale = 0.55 + Math.min(1, Math.max(0, layer.values[index] / max)) * 0.7
    matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(valueScale, valueScale, valueScale))
    mesh.setMatrixAt(index, matrix)
    mesh.setColorAt(index, activationColor(layer.values[index], max, isOutput))
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  group.add(mesh)
  return { group, material, baseX: layerPositions[layerIndex] }
}

export function NetworkScene({ layers, runId }: { layers: LayerActivation[]; runId: number }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const visualsRef = useRef<LayerVisual[]>([])
  const runStartedRef = useRef(performance.now())

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a0c10')
    scene.fog = new THREE.FogExp2('#0a0c10', 0.035)
    const camera = new THREE.PerspectiveCamera(47, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(10.5, 5.2, 12.5)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    sceneRef.current = scene

    const points = layerPositions.map((x) => new THREE.Vector3(x, 0, 0))
    const backbone = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#5e4931', transparent: true, opacity: 0.72 }),
    )
    scene.add(backbone)
    scene.add(new THREE.AmbientLight('#f0d08a', 1.05))

    let frame = 0
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate)
      const elapsed = (time - runStartedRef.current) / 1000
      const activeIndex = Math.min(visualsRef.current.length - 1, Math.floor(elapsed / 0.72))
      visualsRef.current.forEach((visual, index) => {
        const active = index <= activeIndex
        visual.material.opacity += ((active ? 0.94 : 0.11) - visual.material.opacity) * 0.065
        const pulse = index === activeIndex ? 1 + Math.sin(elapsed * 8) * 0.025 : 1
        visual.group.scale.setScalar(pulse)
        visual.group.position.x += (visual.baseX - visual.group.position.x) * 0.08
      })
      const orbit = time * 0.00008
      camera.position.y = 4.5 + Math.sin(orbit * 1.7) * 1.3
      camera.position.z = 12.5 + Math.cos(orbit) * 1.2
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)

    const resize = new ResizeObserver(() => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    })
    resize.observe(mount)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      visualsRef.current.forEach(({ group, material }) => {
        group.traverse((object) => {
          if (object instanceof THREE.InstancedMesh) object.geometry.dispose()
        })
        material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    visualsRef.current.forEach(({ group, material }) => {
      scene.remove(group)
      group.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.geometry.dispose()
      })
      material.dispose()
    })
    visualsRef.current = layers.map(buildLayer)
    visualsRef.current.forEach((visual, index) => {
      visual.group.position.x = visual.baseX - 0.45
      visual.material.opacity = index === 0 ? 0.9 : 0.1
      scene.add(visual.group)
    })
    runStartedRef.current = performance.now()
  }, [layers, runId])

  return <div ref={mountRef} className="network-scene" aria-label="Visualização tridimensional das camadas da rede neural" />
}
