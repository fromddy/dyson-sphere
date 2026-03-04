import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getGeodesicVerticesAndEdges,
  GreatCircleArcCurve,
} from "../utils/geodesic";
import { createBandRoughnessTexture } from "../utils/bandTexture";

const BAND_HALF_WIDTH = 0.06;
const BAND_HALF_THICKNESS = 0.012;
const BAND_SEGMENTS = 16;
const GEODESIC_DETAIL = 1;

// Interior (facing core): warm gold.
const DEFAULT_INTERIOR_COLOR = "#9a8550";
const METALNESS = 0.78;
const ROUGHNESS = 0.5;
const SHEEN = 0.22;
const SHEEN_COLOR = "#e8d8a0";
const SHEEN_ROUGHNESS = 0.55;
const DEFAULT_EXTERIOR_COLOR = "#d4c48a";

/** Set vertex colors: exterior (facing away from origin), interior (facing core).
 *  Also sets a float attribute `aExterior` (1 = exterior, 0 = interior). */
function setExteriorInteriorVertexColors(
  geometry: THREE.BufferGeometry,
  exteriorColor: THREE.Color,
  interiorColor: THREE.Color,
): void {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  if (!posAttr || !normAttr || posAttr.count !== normAttr.count) return;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const exteriorFlags = new Float32Array(count);
  const pos = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    pos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);
    const outward = pos.x * nx + pos.y * ny + pos.z * nz >= 0;
    const c = outward ? exteriorColor : interiorColor;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    exteriorFlags[i] = outward ? 1.0 : 0.0;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute(
    "aExterior",
    new THREE.BufferAttribute(exteriorFlags, 1),
  );
}

/** Flat ribbon geometry along a great-circle arc between v1 and v2. */
function createFlatBandGeometry(
  v1: THREE.Vector3,
  v2: THREE.Vector3,
): THREE.BufferGeometry {
  const curve = new GreatCircleArcCurve(v1, v2);
  const numPts = BAND_SEGMENTS + 1;
  // 4 verts per cross-section: outer-left, outer-right, inner-left, inner-right
  const positions = new Float32Array(numPts * 4 * 3);
  const normals = new Float32Array(numPts * 4 * 3);
  const radial = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < numPts; i++) {
    const t = i / BAND_SEGMENTS;
    const p = curve.getPoint(t);
    tangent.copy(curve.getTangent(t));
    radial.copy(p).normalize();
    binormal.crossVectors(tangent, radial).normalize();

    const b = i * 4;
    const hw = BAND_HALF_WIDTH;
    const ht = BAND_HALF_THICKNESS;

    // 0: outer-left  (+radial, +binormal)
    positions[(b) * 3]     = p.x + binormal.x * hw + radial.x * ht;
    positions[(b) * 3 + 1] = p.y + binormal.y * hw + radial.y * ht;
    positions[(b) * 3 + 2] = p.z + binormal.z * hw + radial.z * ht;
    normals[(b) * 3]     = radial.x;
    normals[(b) * 3 + 1] = radial.y;
    normals[(b) * 3 + 2] = radial.z;

    // 1: outer-right (+radial, -binormal)
    positions[(b + 1) * 3]     = p.x - binormal.x * hw + radial.x * ht;
    positions[(b + 1) * 3 + 1] = p.y - binormal.y * hw + radial.y * ht;
    positions[(b + 1) * 3 + 2] = p.z - binormal.z * hw + radial.z * ht;
    normals[(b + 1) * 3]     = radial.x;
    normals[(b + 1) * 3 + 1] = radial.y;
    normals[(b + 1) * 3 + 2] = radial.z;

    // 2: inner-left  (-radial, +binormal)
    positions[(b + 2) * 3]     = p.x + binormal.x * hw - radial.x * ht;
    positions[(b + 2) * 3 + 1] = p.y + binormal.y * hw - radial.y * ht;
    positions[(b + 2) * 3 + 2] = p.z + binormal.z * hw - radial.z * ht;
    normals[(b + 2) * 3]     = -radial.x;
    normals[(b + 2) * 3 + 1] = -radial.y;
    normals[(b + 2) * 3 + 2] = -radial.z;

    // 3: inner-right (-radial, -binormal)
    positions[(b + 3) * 3]     = p.x - binormal.x * hw - radial.x * ht;
    positions[(b + 3) * 3 + 1] = p.y - binormal.y * hw - radial.y * ht;
    positions[(b + 3) * 3 + 2] = p.z - binormal.z * hw - radial.z * ht;
    normals[(b + 3) * 3]     = -radial.x;
    normals[(b + 3) * 3 + 1] = -radial.y;
    normals[(b + 3) * 3 + 2] = -radial.z;
  }

  const indices: number[] = [];
  for (let i = 0; i < BAND_SEGMENTS; i++) {
    const a = i * 4;
    const n = (i + 1) * 4;
    // Top (exterior): a0→n0→n1, a0→n1→a1
    indices.push(a, n, n + 1, a, n + 1, a + 1);
    // Bottom (interior): a2→a3→n3, a2→n3→n2
    indices.push(a + 2, a + 3, n + 3, a + 2, n + 3, n + 2);
    // Left side: a0→a2→n2, a0→n2→n0
    indices.push(a, a + 2, n + 2, a, n + 2, n);
    // Right side: a1→n1→n3, a1→n3→a3
    indices.push(a + 1, n + 1, n + 3, a + 1, n + 3, a + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

const DEFAULT_EXTERIOR_EMISSIVE = "#1c7fb0";
const DEFAULT_EXTERIOR_EMISSIVE_INTENSITY = 0.35;

interface SphereSkeletonProps {
  layer: number;
  radius: number;
  speed: number;
  axis: "y" | "x";
  speedMultiplier?: number;
  paused?: boolean;
  exteriorColor?: string;
  interiorColor?: string;
  exteriorEmissiveColor?: string;
  exteriorEmissiveIntensity?: number;
  coreVisible?: boolean;
  sharedRotation?: React.RefObject<number>;
}

export function SphereSkeleton({
  radius,
  speed,
  axis,
  speedMultiplier = 1,
  paused = false,
  exteriorColor = DEFAULT_EXTERIOR_COLOR,
  interiorColor = DEFAULT_INTERIOR_COLOR,
  exteriorEmissiveColor = DEFAULT_EXTERIOR_EMISSIVE,
  exteriorEmissiveIntensity = DEFAULT_EXTERIOR_EMISSIVE_INTENSITY,
  coreVisible = true,
  sharedRotation,
}: SphereSkeletonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const exteriorColorVec = useMemo(
    () => new THREE.Color(exteriorColor),
    [exteriorColor],
  );
  const interiorColorVec = useMemo(
    () => new THREE.Color(interiorColor),
    [interiorColor],
  );

  const effectiveInteriorVec = coreVisible ? interiorColorVec : exteriorColorVec;

  const coreVisibleUniform = useRef({ value: 1.0 });
  useEffect(() => {
    coreVisibleUniform.current.value = coreVisible ? 1.0 : 0.0;
  }, [coreVisible]);

  const extEmissiveVec = useMemo(
    () => new THREE.Color(exteriorEmissiveColor),
    [exteriorEmissiveColor],
  );

  const bandMaterial = useMemo(() => {
    const roughnessMap = createBandRoughnessTexture();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: METALNESS,
      roughness: ROUGHNESS,
      roughnessMap,
      sheen: SHEEN,
      sheenColor: SHEEN_COLOR,
      sheenRoughness: SHEEN_ROUGHNESS,
      emissive: "#3a2a18",
      emissiveIntensity: 0.06,
      depthWrite: true,
      depthTest: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uExtEmissive = { value: extEmissiveVec };
      shader.uniforms.uExtEmissiveIntensity = {
        value: exteriorEmissiveIntensity,
      };
      shader.uniforms.uCoreVisible = coreVisibleUniform.current;
      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        "attribute float aExterior;\nvarying float vExterior;\nvoid main() {\n  vExterior = aExterior;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "uniform vec3 uExtEmissive;\nuniform float uExtEmissiveIntensity;\nuniform float uCoreVisible;\nvarying float vExterior;\nvoid main() {",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nfloat emissiveMask = uCoreVisible > 0.5 ? vExterior : mix(0.6, 1.0, vExterior);\ntotalEmissiveRadiance += emissiveMask * uExtEmissive * uExtEmissiveIntensity;",
      );
    };
    mat.needsUpdate = true;
    return mat;
  }, [extEmissiveVec, exteriorEmissiveIntensity]);

  const bands = useMemo(() => {
    const { vertices, edges } = getGeodesicVerticesAndEdges(
      radius,
      GEODESIC_DETAIL,
    );
    const bands: THREE.BufferGeometry[] = [];
    for (const [i, j] of edges) {
      const band = createFlatBandGeometry(
        vertices[i]!.clone(),
        vertices[j]!.clone(),
      );
      setExteriorInteriorVertexColors(band, exteriorColorVec, effectiveInteriorVec);
      bands.push(band);
    }
    return bands;
  }, [radius, exteriorColorVec, effectiveInteriorVec]);

  const effectiveSpeed = paused ? 0 : speed * (speedMultiplier ?? 1);
  useFrame((_, delta) => {
    if (groupRef.current) {
      if (sharedRotation) {
        // Use shared rotation so all layers stay aligned
        if (axis === "y") groupRef.current.rotation.y = sharedRotation.current;
        else groupRef.current.rotation.x = sharedRotation.current;
      } else {
        if (axis === "y") groupRef.current.rotation.y += delta * effectiveSpeed;
        else groupRef.current.rotation.x += delta * effectiveSpeed;
      }
    }
  });

  return (
    <group ref={groupRef} renderOrder={10}>
      {bands.map((geo, i) => (
        <mesh
          key={`band-${i}`}
          geometry={geo}
          material={bandMaterial}
          renderOrder={10}
        />
      ))}
    </group>
  );
}
