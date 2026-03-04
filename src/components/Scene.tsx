import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import * as THREE from "three";
import { Starfield } from "./Starfield";
import { DysonSphere, type LayerConfig } from "./DysonSphere";
import { Galaxy } from "./Galaxy";
import type { CoreColors } from "./CoreGlow";

interface SceneProps {
  speedMultiplier?: number;
  paused?: boolean;
  layerConfigs?: LayerConfig[];
  coreColors?: CoreColors;
  coreVisible?: boolean;
  coreScale?: number;
  galaxyVisible?: boolean;
  shellVisible?: boolean;
  layerCount?: number;
  shipsVisible?: boolean;
}

/** Rotates the scene group with arrow keys; zooms with Z/X. */
function KeyboardOrbit({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const pressed = useRef(new Set<string>());
  const { camera } = useThree();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      pressed.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => {
      pressed.current.delete(e.key);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame(() => {
    const keys = pressed.current;
    const g = groupRef.current;
    if (g) {
      const rotSpeed = 0.005;
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A"))
        g.rotation.y += rotSpeed;
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D"))
        g.rotation.y -= rotSpeed;
      if (keys.has("ArrowUp") || keys.has("w") || keys.has("W"))
        g.rotation.x += rotSpeed;
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S"))
        g.rotation.x -= rotSpeed;
    }
    // Adaptive zoom — slower when close, faster when far
    const distance = camera.position.length();
    const zoomSpeed = 0.005 * Math.sqrt(distance);
    const dir = new THREE.Vector3().copy(camera.position).normalize();
    if (keys.has("z") || keys.has("Z")) {
      const newPos = camera.position.clone().sub(dir.multiplyScalar(zoomSpeed));
      if (newPos.length() > 0.5) camera.position.copy(newPos);
    }
    if (keys.has("x") || keys.has("X")) {
      const newPos = camera.position.clone().add(dir.multiplyScalar(zoomSpeed));
      if (newPos.length() < 1000) camera.position.copy(newPos);
    }
  });

  return null;
}

/** A single ship with an engine trail orbiting the Dyson sphere. */
function ShipWithTrail({
  radius,
  speed,
  tilt,
  shipScale,
}: {
  radius: number;
  speed: number;
  tilt: [number, number, number];
  shipScale: number;
}) {
  const orbitRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const TRAIL_POINTS = 40;

  // Create trail line object
  const trailLine = useMemo(() => {
    const positions = new Float32Array(TRAIL_POINTS * 3);
    const colors = new Float32Array(TRAIL_POINTS * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orbitRef.current) orbitRef.current.rotation.y = t * speed;
    if (bodyRef.current) bodyRef.current.rotation.z = t * 0.4;

    // Update trail: arc behind the ship
    const geo = trailLine.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    const angle = t * speed;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const frac = i / (TRAIL_POINTS - 1); // 0 = ship, 1 = tail end
      const a = angle - frac * 0.8 * Math.sign(speed); // trail spans ~0.8 radians behind
      posAttr.setXYZ(i, Math.cos(a) * radius, 0, -Math.sin(a) * radius);
      const alpha = (1 - frac) * 0.6;
      colAttr.setXYZW(i, 0.27, 0.93, 1.0, alpha);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <group rotation={tilt}>
      {/* Trail line */}
      <primitive object={trailLine} />
      {/* Orbiting ship */}
      <group ref={orbitRef}>
        <group position={[radius, 0, 0]} ref={bodyRef} scale={shipScale}>
          {/* Central body */}
          <mesh>
            <boxGeometry args={[1, 0.6, 0.6]} />
            <meshStandardMaterial
              color="#ccccdd"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
          {/* Solar panel left */}
          <mesh position={[-1.4, 0, 0]}>
            <boxGeometry args={[1.6, 0.04, 0.8]} />
            <meshStandardMaterial
              color="#2244aa"
              metalness={0.4}
              roughness={0.2}
            />
          </mesh>
          {/* Solar panel right */}
          <mesh position={[1.4, 0, 0]}>
            <boxGeometry args={[1.6, 0.04, 0.8]} />
            <meshStandardMaterial
              color="#2244aa"
              metalness={0.4}
              roughness={0.2}
            />
          </mesh>
          {/* Antenna dish */}
          <mesh position={[0, 0.5, 0]} rotation={[0.3, 0, 0]}>
            <coneGeometry args={[0.3, 0.4, 8, 1, true]} />
            <meshStandardMaterial
              color="#aaaaaa"
              metalness={0.7}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Antenna rod */}
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 4]} />
            <meshBasicMaterial color="#dddddd" />
          </mesh>
          {/* Engine glow */}
          <pointLight
            position={[0, 1.2, 0]}
            color="#44eeff"
            intensity={0.6}
            distance={3}
            decay={2}
          />
        </group>
      </group>
    </group>
  );
}

/** Fleet of ships orbiting the Dyson sphere. */
function CoreShips() {
  const ships = [
    {
      radius: 5.5,
      speed: 0.25,
      tilt: [0.3, 0, 0.15] as [number, number, number],
      shipScale: 0.18,
    },
    {
      radius: 6.2,
      speed: -0.18,
      tilt: [0.8, 0.3, 0] as [number, number, number],
      shipScale: 0.14,
    },
    {
      radius: 4.8,
      speed: 0.32,
      tilt: [-0.2, 0.6, 0.1] as [number, number, number],
      shipScale: 0.16,
    },
    {
      radius: 7.0,
      speed: 0.15,
      tilt: [0.5, -0.4, 0.2] as [number, number, number],
      shipScale: 0.12,
    },
  ];
  return (
    <group>
      {ships.map((s, i) => (
        <ShipWithTrail key={i} {...s} />
      ))}
    </group>
  );
}

export function Scene({
  speedMultiplier = 1,
  paused = false,
  layerConfigs,
  coreColors,
  coreVisible = true,
  coreScale = 1,
  galaxyVisible = true,
  shellVisible = true,
  layerCount = 3,
  shipsVisible = true,
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 12], fov: 50 }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.11} />
      <KeyboardOrbit groupRef={groupRef} />
      <group ref={groupRef}>
        <Starfield />
        {galaxyVisible && <Galaxy />}
        {shipsVisible && <CoreShips />}
        <DysonSphere
          speedMultiplier={speedMultiplier}
          paused={paused}
          layerConfigs={layerConfigs}
          coreColors={coreColors}
          coreVisible={coreVisible}
          coreScale={coreScale}
          shellVisible={shellVisible}
          layerCount={layerCount}
        />
      </group>
      <TrackballControls
        noZoom={false}
        noPan={false}
        dynamicDampingFactor={0.05}
        minDistance={1}
        maxDistance={1000}
      />
    </Canvas>
  );
}
