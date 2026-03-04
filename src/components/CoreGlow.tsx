import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ShaderMaterial } from 'three'
import {
  coreBurnShaderMaterialParams,
  coreBurnUniforms,
} from '../shaders/coreBurn'

export interface CoreColors {
  dark: [number, number, number]
  mid: [number, number, number]
  bright: [number, number, number]
  white: [number, number, number]
  lightColor: string
}

interface CoreGlowProps {
  coreColors?: CoreColors
  coreScale?: number
}

export function CoreGlow({ coreColors, coreScale = 1 }: CoreGlowProps) {
  const [hmrKey, setHmrKey] = useState(0)
  const setHmrKeyRef = useRef(setHmrKey)
  setHmrKeyRef.current = setHmrKey

  useEffect(() => {
    if (!import.meta.hot) return
    import.meta.hot.accept(['../shaders/coreBurn'], () => {
      setHmrKeyRef.current((k) => k + 1)
    })
    import.meta.hot.accept(() => {
      setHmrKeyRef.current((k) => k + 1)
    })
  }, [])

  const uniforms = useMemo(() => coreBurnUniforms(), [hmrKey])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        ...coreBurnShaderMaterialParams,
        uniforms,
      }),
    [uniforms],
  )

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    if (coreColors) {
      uniforms.uColorDark.value = coreColors.dark
      uniforms.uColorMid.value = coreColors.mid
      uniforms.uColorBright.value = coreColors.bright
      uniforms.uColorWhite.value = coreColors.white
    }
  })

  const lc = coreColors?.lightColor ?? '#ffdd88'
  const intensityScale = coreScale * coreScale

  return (
    <group>
      <pointLight
        position={[0, 0, 0]}
        color={lc}
        intensity={220 * intensityScale}
        distance={40}
        decay={1.5}
      />
      <pointLight
        position={[0, 0, 0]}
        color={lc}
        intensity={120 * intensityScale}
        distance={32}
        decay={1.6}
      />
      <pointLight
        position={[0, 0, 0]}
        color={lc}
        intensity={50 * intensityScale}
        distance={22}
        decay={1.3}
      />
      <mesh material={material} scale={coreScale}>
        <sphereGeometry args={[0.5, 32, 32]} />
      </mesh>
      <mesh material={material} scale={coreScale}>
        <sphereGeometry args={[0.28, 32, 32]} />
      </mesh>
    </group>
  )
}
