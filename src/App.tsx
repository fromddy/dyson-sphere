import { useState, useEffect, useCallback, useRef } from 'react'
import { Scene } from './components/Scene'
import type { LayerConfig } from './components/DysonSphere'
import './App.css'

const DEFAULT_SPEED = 1
const DEFAULT_LAYERS = 3

function makeLayerConfigs(count: number, color = "#1c7fb0"): LayerConfig[] {
  return Array.from({ length: count }, () => ({ exteriorEmissiveColor: color }))
}

function randomLayerConfigs(count: number): LayerConfig[] {
  const hue = Math.random() * 360
  const s = 60 + Math.random() * 25
  const l = 45 + Math.random() * 20
  const color = `hsl(${hue}, ${s}%, ${l}%)`
  const interior = `hsl(${hue}, ${Math.max(30, s - 20)}%, ${Math.max(20, l - 20)}%)`
  return Array.from({ length: count }, () => ({
    exteriorEmissiveColor: color,
    interiorColor: interior,
  }))
}

function App() {
  const [paused, setPaused] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState(DEFAULT_SPEED)
  const [layerCount, setLayerCount] = useState(DEFAULT_LAYERS)
  const [layerConfigs, setLayerConfigs] = useState(() => makeLayerConfigs(DEFAULT_LAYERS))
  const [showHelp, setShowHelp] = useState(false)
  const [coreVisible, setCoreVisible] = useState(true)
  const [coreScale, setCoreScale] = useState(1)
  const [galaxyVisible, setGalaxyVisible] = useState(true)
  const [shellVisible, setShellVisible] = useState(true)
  const [shipsVisible, setShipsVisible] = useState(true)
  const layerCountRef = useRef(layerCount)
  layerCountRef.current = layerCount

  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key.toLowerCase()) {
      case 'r':
        setLayerConfigs(randomLayerConfigs(layerCountRef.current))
        break
      case 'q':
        setSpeedMultiplier(s => Math.min(100, +(s + 1).toFixed(1)))
        break
      case 'e':
        setSpeedMultiplier(s => Math.max(0, +(s - 1).toFixed(1)))
        break
      case ' ':
        e.preventDefault()
        setPaused(p => !p)
        break
      case 'escape':
        setPaused(false)
        setSpeedMultiplier(DEFAULT_SPEED)
        setLayerCount(DEFAULT_LAYERS)
        setLayerConfigs(makeLayerConfigs(DEFAULT_LAYERS))
        setCoreVisible(true)
        setCoreScale(1)
        setGalaxyVisible(true)
        setShellVisible(true)
        setShipsVisible(true)
        setShowHelp(false)
        break
      case 'c':
        setCoreVisible(v => !v)
        break
      case 'g':
        setGalaxyVisible(v => !v)
        break
      case 'f':
        setShipsVisible(v => !v)
        break
      case '[':
        setLayerCount(n => Math.max(0, n - 1))
        break
      case ']':
        setLayerCount(n => Math.min(60, n + 1))
        break
      case '1':
        setCoreScale(0.3)
        break
      case '2':
        setCoreScale(0.5)
        break
      case '3':
        setCoreScale(0.8)
        break
      case '4':
        setCoreScale(1)
        break
      case '5':
        setCoreScale(1.5)
        break
      case '6':
        setCoreScale(2.2)
        break
      case 'h':
        setShowHelp(v => !v)
        break
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="app">
      <Scene
        speedMultiplier={speedMultiplier}
        paused={paused}
        layerConfigs={layerConfigs}
        coreVisible={coreVisible}
        coreScale={coreScale}
        galaxyVisible={galaxyVisible}
        shellVisible={shellVisible}
        layerCount={layerCount}
        shipsVisible={shipsVisible}
      />
      {showHelp && (
        <div className="help-panel">
          <h3>Controls</h3>
          <div className="help-row"><kbd>R</kbd><span>Randomize colors</span></div>
          <div className="help-row"><kbd>Q</kbd> <kbd>E</kbd><span>Speed ±</span></div>
          <div className="help-row"><kbd>WASD</kbd> / <kbd>↑↓←→</kbd><span>Rotate view</span></div>
          <div className="help-row"><kbd>Z</kbd> <kbd>X</kbd><span>Zoom in / out</span></div>
          <div className="help-row"><kbd>Space</kbd><span>Pause / Resume</span></div>
          <div className="help-row"><kbd>C</kbd><span>Toggle core star</span></div>
          <div className="help-row"><kbd>G</kbd><span>Toggle galaxy</span></div>
          <div className="help-row"><kbd>F</kbd><span>Toggle ships</span></div>
          <div className="help-row"><kbd>[</kbd> <kbd>]</kbd><span>Layers ± (0–60)</span></div>
          <div className="help-row"><kbd>1</kbd>–<kbd>6</kbd><span>Core size</span></div>
          <div className="help-row"><kbd>Esc</kbd><span>Reset defaults</span></div>
          <div className="help-row"><kbd>H</kbd><span>Toggle help</span></div>
        </div>
      )}
    </div>
  )
}

export default App
