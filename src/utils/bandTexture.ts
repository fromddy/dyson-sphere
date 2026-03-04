import * as THREE from 'three'

const W = 64
const H = 4
const STRIPE_PERIOD = 4

/**
 * Procedural repeat texture for band etched/groove look.
 * Used as roughnessMap: slightly rougher (lighter) lines along the band.
 */
export function createBandRoughnessTexture(): THREE.DataTexture {
  const size = W * H
  const data = new Uint8Array(size * 4)
  const baseRoughness = 0.38
  const grooveRoughness = 0.52
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const isGroove = Math.floor(x / STRIPE_PERIOD) % 2 === 0
      const v = (isGroove ? grooveRoughness : baseRoughness) * 255
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, W, H)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

const SEGMENT_W = 128
const SEGMENT_H = 8
const SEGMENT_LEN = 6
const GAP_LEN = 3

/**
 * Segmented/dashed line along the band: alternating bright segments and dark gaps (monochrome).
 * Used as map for a technical-drawing style.
 */
export function createBandSegmentMap(): THREE.DataTexture {
  const data = new Uint8Array(SEGMENT_W * SEGMENT_H * 4)
  for (let y = 0; y < SEGMENT_H; y++) {
    for (let x = 0; x < SEGMENT_W; x++) {
      const i = (y * SEGMENT_W + x) * 4
      const phase = x % (SEGMENT_LEN + GAP_LEN)
      const bright = phase < SEGMENT_LEN
      const v = bright ? 100 : 0
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = v
    }
  }
  const tex = new THREE.DataTexture(data, SEGMENT_W, SEGMENT_H)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}
