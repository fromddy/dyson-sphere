import * as THREE from 'three'

const SLERP_EPS = 1e-6

/**
 * Curve for the great-circle arc on the sphere between two points (slerp).
 * getPoint(t) lies on the sphere at radius = length of v1 (v1 and v2 must be on same sphere).
 */
export class GreatCircleArcCurve extends THREE.Curve<THREE.Vector3> {
  v1: THREE.Vector3
  v2: THREE.Vector3

  constructor(v1: THREE.Vector3, v2: THREE.Vector3) {
    super()
    this.v1 = v1
    this.v2 = v2
  }

  getPoint(t: number, optionalTarget?: THREE.Vector3): THREE.Vector3 {
    const result = optionalTarget ?? new THREE.Vector3()
    const a = this.v1
    const b = this.v2
    const dot = a.x * b.x + a.y * b.y + a.z * b.z
    const theta = Math.acos(THREE.MathUtils.clamp(dot / (a.length() * b.length()), -1, 1))
    if (theta < SLERP_EPS) {
      return result.copy(a).lerp(b, t)
    }
    const sinTheta = Math.sin(theta)
    const c1 = Math.sin((1 - t) * theta) / sinTheta
    const c2 = Math.sin(t * theta) / sinTheta
    return result.set(
      c1 * a.x + c2 * b.x,
      c1 * a.y + c2 * b.y,
      c1 * a.z + c2 * b.z,
    )
  }
}

function vecKey(v: THREE.Vector3): string {
  return `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`
}

/**
 * Builds vertices and edges from subdivided octahedron (triangle mesh on sphere).
 * 6-way nodes at subdivided vertices have equal 60° angles; 4-way at original 6 vertices are symmetric.
 * PolyhedronGeometry is non-indexed, so we dedupe by position and extract edges from triangles.
 */
export function getGeodesicVerticesAndEdges(radius: number, detail: number): {
  vertices: THREE.Vector3[]
  edges: [number, number][]
} {
  const geo = new THREE.OctahedronGeometry(1, detail)
  const posAttr = geo.attributes.position
  if (!posAttr || posAttr.count < 3) {
    geo.dispose()
    return { vertices: [], edges: [] }
  }

  const keyToIndex = new Map<string, number>()
  const vertices: THREE.Vector3[] = []

  function getOrAddVertex(x: number, y: number, z: number): number {
    const v = new THREE.Vector3(x * radius, y * radius, z * radius)
    const key = vecKey(v)
    let idx = keyToIndex.get(key)
    if (idx === undefined) {
      idx = vertices.length
      keyToIndex.set(key, idx)
      vertices.push(v)
    }
    return idx
  }

  const edgeSet = new Set<string>()
  const edges: [number, number][] = []

  for (let i = 0; i < posAttr.count; i += 3) {
    const x0 = posAttr.getX(i)
    const y0 = posAttr.getY(i)
    const z0 = posAttr.getZ(i)
    const x1 = posAttr.getX(i + 1)
    const y1 = posAttr.getY(i + 1)
    const z1 = posAttr.getZ(i + 1)
    const x2 = posAttr.getX(i + 2)
    const y2 = posAttr.getY(i + 2)
    const z2 = posAttr.getZ(i + 2)
    const a = getOrAddVertex(x0, y0, z0)
    const b = getOrAddVertex(x1, y1, z1)
    const c = getOrAddVertex(x2, y2, z2)
    const add = (u: number, v: number) => {
      const key = u < v ? `${u},${v}` : `${v},${u}`
      if (!edgeSet.has(key)) {
        edgeSet.add(key)
        edges.push([u, v])
      }
    }
    add(a, b)
    add(b, c)
    add(c, a)
  }

  geo.dispose()
  return { vertices, edges }
}
