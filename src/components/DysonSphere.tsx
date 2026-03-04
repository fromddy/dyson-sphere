import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CoreGlow, type CoreColors } from "./CoreGlow";
import { SphereSkeleton } from "./SphereSkeleton";

const BASE_SPEED = 0.06;
const BASE_RADIUS = 2.2;
const LAYER_GAP = 0.8;
const DEFAULT_EMISSIVE = "#1c7fb0";

/** Interpolate exterior color from warm gold (inner) to pale gold (outer). */
function layerExteriorColor(i: number, total: number): string {
  const t = total <= 1 ? 0 : i / (total - 1);
  const r = Math.round(200 + t * 24);
  const g = Math.round(184 + t * 24);
  const b = Math.round(120 + t * 36);
  return `rgb(${r},${g},${b})`;
}

export interface LayerConfig {
  exteriorEmissiveColor: string;
  interiorColor?: string;
}

interface DysonSphereProps {
  speedMultiplier?: number;
  paused?: boolean;
  layerConfigs?: LayerConfig[];
  coreColors?: CoreColors;
  coreVisible?: boolean;
  coreScale?: number;
  shellVisible?: boolean;
  layerCount?: number;
}

export function DysonSphere({
  speedMultiplier = 1,
  paused = false,
  layerConfigs,
  coreColors,
  coreVisible = true,
  coreScale = 1,
  shellVisible = true,
  layerCount = 3,
}: DysonSphereProps) {
  const layers = useMemo(() => {
    return Array.from({ length: layerCount }, (_, i) => ({
      radius: BASE_RADIUS + i * LAYER_GAP,
      exteriorColor: layerExteriorColor(i, layerCount),
    }));
  }, [layerCount]);

  const rotationRef = useRef(0);
  const effectiveSpeed = paused ? 0 : BASE_SPEED * speedMultiplier;
  useFrame((_, delta) => {
    rotationRef.current += delta * effectiveSpeed;
  });

  return (
    <group>
      {coreVisible && <CoreGlow coreColors={coreColors} coreScale={coreScale} />}
      {shellVisible && layers.map(({ radius, exteriorColor }, i) => (
        <SphereSkeleton
          key={i}
          layer={i}
          radius={radius}
          speed={BASE_SPEED}
          axis="y"
          speedMultiplier={speedMultiplier}
          paused={paused}
          exteriorColor={exteriorColor}
          exteriorEmissiveColor={layerConfigs?.[i]?.exteriorEmissiveColor ?? DEFAULT_EMISSIVE}
          interiorColor={layerConfigs?.[i]?.interiorColor}
          coreVisible={coreVisible}
          sharedRotation={rotationRef}
        />
      ))}
    </group>
  );
}
