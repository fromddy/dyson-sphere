import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ShaderMaterial } from 'three'
import {
  coreBurnShaderMaterialParams,
  coreBurnUniforms,
} from '../shaders/coreBurn'

/* ── Seeded PRNG ── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── Star color palettes ── */
const STAR_PALETTES = {
  redGiant: {
    dark: [0.5, 0.05, 0.02] as [number, number, number],
    mid: [0.9, 0.2, 0.05] as [number, number, number],
    bright: [1.0, 0.5, 0.15] as [number, number, number],
    white: [1.0, 0.85, 0.6] as [number, number, number],
    light: '#ff6622',
  },
  blueStar: {
    dark: [0.02, 0.08, 0.4] as [number, number, number],
    mid: [0.1, 0.3, 0.85] as [number, number, number],
    bright: [0.4, 0.7, 1.0] as [number, number, number],
    white: [0.85, 0.95, 1.0] as [number, number, number],
    light: '#6699ff',
  },
  yellowStar: {
    dark: [0.45, 0.25, 0.05] as [number, number, number],
    mid: [0.95, 0.7, 0.15] as [number, number, number],
    bright: [1.0, 0.9, 0.5] as [number, number, number],
    white: [1.0, 0.98, 0.85] as [number, number, number],
    light: '#ffcc44',
  },
  whiteDwarf: {
    dark: [0.5, 0.5, 0.55] as [number, number, number],
    mid: [0.8, 0.82, 0.9] as [number, number, number],
    bright: [0.95, 0.95, 1.0] as [number, number, number],
    white: [1.0, 1.0, 1.0] as [number, number, number],
    light: '#eeeeff',
  },
}
type PaletteKey = keyof typeof STAR_PALETTES

/* ── Banded texture for gas planets ── */
function createBandedTexture(baseColor: string, seed: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const rng = mulberry32(seed)
  const base = new THREE.Color(baseColor)

  for (let y = 0; y < 256; y++) {
    const band = Math.sin(y * 0.12) * 0.08 + Math.sin(y * 0.25 + 2) * 0.05
    const noise = (rng() - 0.5) * 0.06
    const c = base.clone()
    c.offsetHSL(noise * 0.1, noise * 0.15, band + noise)
    ctx.fillStyle = `#${c.getHexString()}`
    ctx.fillRect(0, y, 64, 1)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/* ── Orbit ring (glowing track) ── */
function OrbitRing({ radius, color }: { radius: number; color: string }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {/* Core ring */}
      <mesh>
        <torusGeometry args={[radius, 0.02, 4, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <torusGeometry args={[radius, 0.08, 4, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} />
      </mesh>
    </group>
  )
}

/* ── Orbiting body wrapper ── */
function OrbitingBody({
  radius,
  tilt,
  speed,
  angle0,
  ringColor,
  children,
}: {
  radius: number
  tilt: number
  speed: number
  angle0: number
  ringColor: string
  children: React.ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = angle0 + state.clock.elapsedTime * speed
    }
  })

  return (
    <group rotation={[tilt, 0, 0]}>
      <OrbitRing radius={radius} color={ringColor} />
      <group ref={ref}>
        <group position={[radius, 0, 0]}>{children}</group>
      </group>
    </group>
  )
}

/* ── Burning Star (coreBurn shader) ── */
function BurningStar({ scale, palette, speed }: {
  scale: number; palette: PaletteKey; speed: number
}) {
  const p = STAR_PALETTES[palette]
  const uniforms = useMemo(() => {
    const u = coreBurnUniforms()
    u.uColorDark.value = [...p.dark]
    u.uColorMid.value = [...p.mid]
    u.uColorBright.value = [...p.bright]
    u.uColorWhite.value = [...p.white]
    return u
  }, [p])

  const material = useMemo(
    () => new ShaderMaterial({ ...coreBurnShaderMaterialParams, uniforms }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime * speed
  })

  return (
    <group>
      <pointLight
        color={p.light}
        intensity={scale * scale * 30}
        distance={scale * 15}
        decay={1.8}
      />
      <mesh material={material} scale={scale}>
        <sphereGeometry args={[0.5, 24, 24]} />
      </mesh>
    </group>
  )
}

/* ── Black Hole ── */
function BlackHole({ scale }: { scale: number }) {
  const diskRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (diskRef.current) diskRef.current.rotation.z = state.clock.elapsedTime * 0.3
  })

  return (
    <group>
      <mesh scale={scale}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={diskRef} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
        <torusGeometry args={[0.9, 0.18, 8, 64]} />
        <meshBasicMaterial color="#ff8833" transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={scale}>
        <torusGeometry args={[0.55, 0.06, 8, 64]} />
        <meshBasicMaterial color="#ffcc66" transparent opacity={0.7} />
      </mesh>
      <pointLight color="#ff7722" intensity={scale * 8} distance={scale * 12} decay={2} />
    </group>
  )
}

/* ── Gas Planet (beautified with banded texture + atmosphere) ── */
function GasPlanet({ scale, color, hasRing, ringColor, selfTilt, seed }: {
  scale: number; color: string; hasRing: boolean
  ringColor: string; selfTilt: number; seed: number
}) {
  const ref = useRef<THREE.Group>(null)
  const texture = useMemo(() => createBandedTexture(color, seed), [color, seed])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.15
  })

  return (
    <group rotation={[selfTilt, 0, 0]} ref={ref}>
      {/* Planet body with banded texture */}
      <mesh scale={scale}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial map={texture} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={scale * 1.06}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {/* Ring */}
      {hasRing && (
        <mesh rotation={[Math.PI / 2.3, 0, 0]} scale={scale}>
          <ringGeometry args={[0.65, 0.95, 64]} />
          <meshStandardMaterial
            color={ringColor}
            transparent
            opacity={0.45}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

/* ── Nebula Cloud ── */
function NebulaCloud({ color, scale, seed }: {
  color: string; scale: number; seed: number
}) {
  const ref = useRef<THREE.Points>(null)
  const COUNT = 120

  const positions = useMemo(() => {
    const rng = mulberry32(seed)
    const pos = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const r = scale * (rng() + rng() + rng()) / 3
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    return pos
  }, [seed, scale])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.015
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.4 * scale}
        color={color}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/* ── Moon (small satellite orbiting a body) ── */
function Moon({ radius, speed, size, tilt }: {
  radius: number; speed: number; size: number; tilt: number
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed
  })
  return (
    <group rotation={[tilt, 0, 0]} ref={ref}>
      <group position={[radius, 0, 0]}>
        <mesh scale={size}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial color="#bbbbaa" roughness={0.85} metalness={0.05} />
        </mesh>
      </group>
    </group>
  )
}

/* ── Tiny Spaceship orbiting a body (with engine trail) ── */
function TinyShip({ radius, speed, tilt }: {
  radius: number; speed: number; tilt: number
}) {
  const ref = useRef<THREE.Group>(null)
  const TRAIL_PTS = 24

  const trailLine = useMemo(() => {
    const pos = new Float32Array(TRAIL_PTS * 3)
    const col = new Float32Array(TRAIL_PTS * 4)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    return new THREE.Line(geo, mat)
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.y = t * speed

    // Update trail arc
    const geo = trailLine.geometry
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute
    const angle = t * speed
    for (let i = 0; i < TRAIL_PTS; i++) {
      const frac = i / (TRAIL_PTS - 1)
      const a = angle - frac * 0.5 * Math.sign(speed)
      posAttr.setXYZ(i, Math.cos(a) * radius, 0, -Math.sin(a) * radius)
      const alpha = (1 - frac) * 0.5
      colAttr.setXYZW(i, 0.27, 0.93, 1.0, alpha)
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
  })

  return (
    <group rotation={[tilt, 0, 0]}>
      <primitive object={trailLine} />
      <group ref={ref}>
        <group position={[radius, 0, 0]}>
          {/* Hull */}
          <mesh scale={0.12} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.4, 1.8, 4]} />
            <meshBasicMaterial color="#ccddff" />
          </mesh>
          {/* Engine glow */}
          <pointLight color="#44eeff" intensity={1.2} distance={3} decay={2} />
        </group>
      </group>
    </group>
  )
}

/* ── Body definition with orbital params ── */
interface BodyDef {
  type: 'star' | 'blackhole' | 'planet' | 'nebula'
  orbitRadius: number
  orbitTilt: number
  orbitSpeed: number
  orbitAngle0: number
  scale: number
  palette?: PaletteKey
  animSpeed?: number
  color?: string
  hasRing?: boolean
  ringColor?: string
  selfTilt?: number
  seed?: number
  ringColorHex?: string
  moonCount?: number
  hasShip?: boolean
}

function generateBodies(): BodyDef[] {
  const rng = mulberry32(314159)
  const bodies: BodyDef[] = []
  const SHARED_TILT = 0.18

  // Pre-defined radii slots — evenly staggered with slight jitter
  const radii = [13, 17, 21, 26, 31, 36, 41, 46, 51, 56, 61, 66, 71]
  let slot = 0
  const nextR = () => {
    const r = radii[slot % radii.length] + (rng() - 0.5) * 2
    slot++
    return r
  }
  const orbit = () => ({
    orbitRadius: nextR(),
    orbitTilt: SHARED_TILT,
    orbitSpeed: (0.02 + rng() * 0.06) * (rng() > 0.5 ? 1 : -1),
    orbitAngle0: rng() * Math.PI * 2,
  })

  // Gas planets (3) — inner orbits
  const pColors = ['#4488aa', '#88aa55', '#aa7744']
  const rColors = ['#ccbb88', '#aabbcc', '#bbaa77']
  const planetMoons = [2, 0, 1]   // first planet: 2 moons, third: 1
  const planetShips = [true, true, true] // all inner planets have ships
  for (let i = 0; i < 3; i++) {
    bodies.push({
      type: 'planet', ...orbit(),
      scale: 0.5 + rng() * 0.6,
      color: pColors[i],
      hasRing: rng() > 0.4,
      ringColor: rColors[i],
      selfTilt: (rng() - 0.5) * 0.6,
      seed: Math.floor(rng() * 99999),
      ringColorHex: pColors[i],
      moonCount: planetMoons[i],
      hasShip: planetShips[i],
    })
  }

  // Stars (6) — mid orbits
  const starDefs: { p: PaletteKey; min: number; max: number; ship?: boolean }[] = [
    { p: 'yellowStar', min: 0.3, max: 0.5 },
    { p: 'blueStar', min: 0.35, max: 0.6, ship: true },
    { p: 'redGiant', min: 0.9, max: 1.4, ship: true },
    { p: 'whiteDwarf', min: 0.18, max: 0.28 },
    { p: 'blueStar', min: 0.4, max: 0.65 },
    { p: 'yellowStar', min: 0.3, max: 0.55 },
  ]
  for (const d of starDefs) {
    bodies.push({
      type: 'star', ...orbit(),
      scale: d.min + rng() * (d.max - d.min),
      palette: d.p,
      animSpeed: 0.5 + rng() * 1.5,
      ringColorHex: STAR_PALETTES[d.p].light,
      hasShip: d.ship,
    })
  }

  // Black hole (1) — with a ship being pulled in
  bodies.push({
    type: 'blackhole', ...orbit(),
    scale: 0.7 + rng() * 0.5,
    ringColorHex: '#ff7722',
    hasShip: true,
  })

  // Nebulae (2) — outer orbits
  const nColors = ['#ff66aa', '#6688ff']
  for (let i = 0; i < 2; i++) {
    bodies.push({
      type: 'nebula', ...orbit(),
      scale: 2 + rng() * 2,
      color: nColors[i],
      seed: Math.floor(rng() * 99999),
      ringColorHex: nColors[i],
    })
  }

  // One more planet at the far edge — with moon
  bodies.push({
    type: 'planet', ...orbit(),
    scale: 0.6 + rng() * 0.5,
    color: '#7755aa',
    hasRing: true,
    ringColor: '#99aadd',
    selfTilt: (rng() - 0.5) * 0.5,
    seed: Math.floor(rng() * 99999),
    ringColorHex: '#7755aa',
    moonCount: 1,
  })

  return bodies
}

/* ── Glowing Axis ── */
const AXIS_HALF = 80
function GlowingAxis() {
  return (
    <group>
      {/* Core line */}
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, AXIS_HALF * 2, 6]} />
        <meshBasicMaterial color="#88bbff" transparent opacity={0.6} />
      </mesh>
      {/* Outer glow */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, AXIS_HALF * 2, 8]} />
        <meshBasicMaterial color="#4488cc" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

/* ── Main Galaxy Component ── */
const SHARED_TILT = 0.18
export function Galaxy() {
  const bodies = useMemo(() => generateBodies(), [])

  return (
    <group rotation={[SHARED_TILT, 0, 0]}>
      <GlowingAxis />
      {bodies.map((b, i) => (
        <OrbitingBody
          key={i}
          radius={b.orbitRadius}
          tilt={0}
          speed={b.orbitSpeed}
          angle0={b.orbitAngle0}
          ringColor={b.ringColorHex ?? '#444466'}
        >
          {b.type === 'star' && (
            <BurningStar
              scale={b.scale}
              palette={b.palette!}
              speed={b.animSpeed!}
            />
          )}
          {b.type === 'blackhole' && <BlackHole scale={b.scale} />}
          {b.type === 'planet' && (
            <GasPlanet
              scale={b.scale}
              color={b.color!}
              hasRing={b.hasRing!}
              ringColor={b.ringColor!}
              selfTilt={b.selfTilt!}
              seed={b.seed!}
            />
          )}
          {b.type === 'nebula' && (
            <NebulaCloud
              color={b.color!}
              scale={b.scale}
              seed={b.seed!}
            />
          )}
          {/* Moons */}
          {Array.from({ length: b.moonCount ?? 0 }, (_, mi) => (
            <Moon
              key={`moon-${mi}`}
              radius={b.scale * 0.7 + mi * 0.35}
              speed={1.5 + mi * 0.8}
              size={0.06 + mi * 0.03}
              tilt={0.3 + mi * 0.5}
            />
          ))}
          {/* Spaceship */}
          {b.hasShip && (
            <TinyShip
              radius={b.scale * 0.9 + 0.3}
              speed={2.2}
              tilt={-0.4}
            />
          )}
        </OrbitingBody>
      ))}
    </group>
  )
}