import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const SPHERE_RADIUS = 2.8
const LINE_DISTANCE = 1.0

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export interface OracleNode {
  id: string
  name: string
  initial: string
  color: string
  owner?: string  // GitHub username or wallet (for grouping)
}

interface OwnerGroup {
  owner: string | undefined
  oracles: OracleNode[]
}

function OracleLabels({ oracles, isMobile }: { oracles: OracleNode[]; isMobile: boolean }) {
  // Group oracles by owner
  const groups = useMemo(() => {
    const map = new Map<string, OracleNode[]>()
    for (const o of oracles) {
      const key = o.owner || o.id // ungrouped oracles get their own "group"
      const list = map.get(key) || []
      list.push(o)
      map.set(key, list)
    }
    const result: OwnerGroup[] = []
    for (const [, list] of map) {
      result.push({ owner: list[0].owner, oracles: list })
    }
    return result
  }, [oracles])

  const maxGroups = isMobile ? 8 : 12
  const shown = groups.slice(0, maxGroups)

  const MAX_PER_GROUP = 20

  // For each group, compute individual oracle positions
  // Large groups spread across the hemisphere; small groups cluster around their center
  const oraclePositions = useMemo(() => {
    const result: Map<number, THREE.Vector3[]> = new Map()
    const r = SPHERE_RADIUS * 0.75
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    // Collect all oracle positions from all groups into one flat list
    // so they distribute across the full hemisphere without overlapping
    const allItems: { gi: number; oi: number }[] = []
    for (let gi = 0; gi < shown.length; gi++) {
      const visCount = Math.min(shown[gi].oracles.length, MAX_PER_GROUP)
      for (let oi = 0; oi < visCount; oi++) {
        allItems.push({ gi, oi })
      }
    }

    const n = allItems.length
    // Distribute ALL oracle labels across the front hemisphere using golden angle
    for (let idx = 0; idx < n; idx++) {
      const { gi } = allItems[idx]
      const y = 0.8 - (1.6 * (idx + 0.5)) / n
      const radiusAtY = Math.sqrt(1 - Math.min(y * y, 0.99))
      const theta = goldenAngle * idx
      const z = Math.abs(radiusAtY * Math.cos(theta)) * 0.4 + 0.3
      const x = radiusAtY * Math.sin(theta)
      const pos = new THREE.Vector3(x * r, y * r, z * r)

      if (!result.has(gi)) result.set(gi, [])
      result.get(gi)!.push(pos)
    }
    return result
  }, [shown])

  return (
    <group>
      {shown.map((group, gi) => {
        const positions = oraclePositions.get(gi) || []
        const visibleOracles = group.oracles.slice(0, MAX_PER_GROUP)
        const extraCount = group.oracles.length - MAX_PER_GROUP
        const isCluster = group.oracles.length > 1 && group.owner

        // Owner label — centered above the group's first oracle
        const ownerPos = positions[0]
          ? new THREE.Vector3(positions[0].x, positions[0].y + SPHERE_RADIUS * 0.12, positions[0].z)
          : new THREE.Vector3(0, SPHERE_RADIUS * 0.8, 1)

        return (
          <group key={group.owner || group.oracles[0]?.id || `group-${gi}`}>
            {isCluster && (
              <Html position={ownerPos} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
                <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                  @{group.owner}
                </span>
              </Html>
            )}

            {visibleOracles.map((oracle, oi) => {
              const pos = positions[oi] || new THREE.Vector3(0, 0, 1)
              return (
                <Html key={oracle.id} position={pos} center distanceFactor={6} style={{ pointerEvents: 'auto' }}>
                  <a
                    href="/world"
                    className="flex items-center gap-2 rounded-full border border-slate-600/50 bg-slate-900/80 px-3 py-1.5 backdrop-blur-sm transition-all hover:border-orange-500/40 hover:bg-slate-800/90 whitespace-nowrap"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: oracle.color }}
                    >
                      {oracle.initial}
                    </div>
                    <span className="text-xs font-medium text-slate-300">{oracle.name}</span>
                  </a>
                </Html>
              )
            })}

            {extraCount > 0 && (
              <Html
                position={new THREE.Vector3(
                  (positions[positions.length - 1]?.x || 0),
                  (positions[positions.length - 1]?.y || 0) - SPHERE_RADIUS * 0.1,
                  (positions[positions.length - 1]?.z || 1),
                )}
                center
                distanceFactor={6}
                style={{ pointerEvents: 'none' }}
              >
                <span className="text-[10px] text-slate-600 whitespace-nowrap">+{extraCount} more</span>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

function Particles({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const linesRef = useRef<THREE.LineSegments>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const positions = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const goldenRatio = (1 + Math.sqrt(5)) / 2
    for (let i = 0; i < count; i++) {
      const theta = Math.acos(1 - 2 * (i + 0.5) / count)
      const phi = 2 * Math.PI * i / goldenRatio
      pts.push(new THREE.Vector3(
        SPHERE_RADIUS * Math.sin(theta) * Math.cos(phi),
        SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi),
        SPHERE_RADIUS * Math.cos(theta),
      ))
    }
    return pts
  }, [])

  const linePairs = useMemo(() => {
    const pairs: number[] = []
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].distanceTo(positions[j]) < LINE_DISTANCE) {
          pairs.push(i, j)
        }
      }
    }
    return pairs
  }, [positions])

  // Static positions — no manual rotation (OrbitControls handles it)
  useFrame(({ clock }) => {
    const breathe = 1 + 0.05 * Math.sin(clock.getElapsedTime() * 0.6)

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      dummy.position.set(p.x * breathe, p.y * breathe, p.z * breathe)
      dummy.scale.setScalar(0.02)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true

    const linePos = linesRef.current.geometry.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < linePairs.length; k += 2) {
      const pi = positions[linePairs[k]]
      const pj = positions[linePairs[k + 1]]
      const idx = k * 3
      linePos.array[idx] = pi.x * breathe
      linePos.array[idx + 1] = pi.y * breathe
      linePos.array[idx + 2] = pi.z * breathe
      linePos.array[idx + 3] = pj.x * breathe
      linePos.array[idx + 4] = pj.y * breathe
      linePos.array[idx + 5] = pj.z * breathe
    }
    linePos.needsUpdate = true
  })

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const arr = new Float32Array(linePairs.length * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return geo
  }, [linePairs])

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.85} />
      </instancedMesh>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial color="#f97316" transparent opacity={0.15} />
      </lineSegments>
    </group>
  )
}

export function ResonanceSphere({ className, oracles = [] }: { className?: string; oracles?: OracleNode[] }) {
  const isMobile = useIsMobile()
  const particleCount = isMobile ? 120 : 250
  const cameraZ = isMobile ? 8 : 5.5

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0.3, cameraZ], fov: 50 }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        resize={{ scroll: true, debounce: { scroll: 50, resize: 0 } }}
      >
        <Particles count={particleCount} />
        {oracles.length > 0 && <OracleLabels oracles={oracles} isMobile={isMobile} />}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.1}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  )
}
