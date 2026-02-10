import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, TreePine, ArrowDown, Hash, Wallet, ExternalLink, CheckCircle2, ShieldCheck, ChevronDown, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import { API_URL } from '@/lib/pocketbase'
import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { checksumAddress } from '@/lib/utils'

type LeafData = {
  bot_wallet: string
  birth_issue: string
  issue_number: number
  oracle_name: string
}

type MerkleData = {
  wallet: string
  merkle_root: string
  oracle_count: number
  leaves: LeafData[]
}

type TreeResult = {
  layers: string[][]
  leafNames: Map<string, string> // hash → oracle name
  leafIndexMap: Map<string, number> // hash → index in leaves array
  flatTree: string[]
  valueMap: { treeIndex: number }[]
}

type ProofPathNode = {
  layer: number
  position: number
  role: 'leaf' | 'sibling' | 'computed' | 'root'
  step: number
}

/** Compute all layers of the Merkle tree for visualization */
function computeTreeLayers(leaves: LeafData[]): TreeResult {
  if (leaves.length === 0) return { layers: [], leafNames: new Map(), leafIndexMap: new Map(), flatTree: [], valueMap: [] }

  const tuples: [string, string, bigint][] = leaves.map(l => [
    l.bot_wallet.toLowerCase(),
    l.birth_issue,
    BigInt(l.issue_number),
  ])
  const tree = StandardMerkleTree.of(tuples, ['address', 'string', 'uint256'])

  // Build hash → oracle name map and hash → leaf index map from the tree's leaf entries
  const leafNames = new Map<string, string>()
  const leafIndexMap = new Map<string, number>()
  const dump = tree.dump()
  for (const v of dump.values) {
    const hash = dump.tree[v.treeIndex]
    const leafIdx = leaves.findIndex(l =>
      l.bot_wallet.toLowerCase() === (v.value[0] as string).toLowerCase() &&
      l.issue_number === Number(v.value[2])
    )
    if (hash && leafIdx >= 0) {
      leafNames.set(hash, leaves[leafIdx].oracle_name || `#${leaves[leafIdx].issue_number}`)
      leafIndexMap.set(hash, leafIdx)
    }
  }

  // Reconstruct layers from the tree's internal flat array
  const treeValues = dump.tree
  const layers: string[][] = []
  let remaining = treeValues.length
  const widths: number[] = []
  let w = 1
  while (remaining > 0) {
    const layerSize = Math.min(w, remaining)
    widths.push(layerSize)
    remaining -= layerSize
    w *= 2
  }

  let idx = 0
  for (const size of widths) {
    layers.push(treeValues.slice(idx, idx + size))
    idx += size
  }

  return { layers, leafNames, leafIndexMap, flatTree: treeValues, valueMap: dump.values.map((v: { treeIndex: number }) => ({ treeIndex: v.treeIndex })) }
}

function shortHash(hash: string): string {
  if (!hash || hash.length < 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

/** Compute the proof path from leaf to root for animation highlighting */
function computeProofPath(
  flatTree: string[],
  valueMap: { treeIndex: number }[],
  leafIndex: number,
  treeLayers: string[][]
): ProofPathNode[] {
  if (leafIndex >= valueMap.length || treeLayers.length === 0) return []

  const treeIndex = valueMap[leafIndex].treeIndex

  // Build flat index → (layer, position) lookup
  const indexToLayerPos = new Map<number, { layer: number; position: number }>()
  let offset = 0
  for (let layer = 0; layer < treeLayers.length; layer++) {
    for (let pos = 0; pos < treeLayers[layer].length; pos++) {
      indexToLayerPos.set(offset + pos, { layer, position: pos })
    }
    offset += treeLayers[layer].length
  }

  const path: ProofPathNode[] = []
  let step = 0

  // Single node tree: leaf = root
  if (treeIndex === 0) {
    path.push({ layer: 0, position: 0, role: 'root', step: 0 })
    return path
  }

  // Start with the leaf
  const leafPos = indexToLayerPos.get(treeIndex)
  if (!leafPos) return []
  path.push({ layer: leafPos.layer, position: leafPos.position, role: 'leaf', step: step++ })

  let current = treeIndex
  while (current > 0) {
    // Find sibling (odd index = left child, even = right child)
    const isLeftChild = current % 2 === 1
    const siblingIndex = isLeftChild ? current + 1 : current - 1

    if (siblingIndex > 0 && siblingIndex < flatTree.length) {
      const sibPos = indexToLayerPos.get(siblingIndex)
      if (sibPos) {
        path.push({ layer: sibPos.layer, position: sibPos.position, role: 'sibling', step: step++ })
      }
    }

    // Move to parent
    const parentIndex = Math.floor((current - 1) / 2)
    const parentPos = indexToLayerPos.get(parentIndex)
    if (parentPos) {
      const isRoot = parentIndex === 0
      path.push({
        layer: parentPos.layer,
        position: parentPos.position,
        role: isRoot ? 'root' : 'computed',
        step: step++
      })
    }

    current = parentIndex
  }

  return path
}

function getStepDescription(proofPath: ProofPathNode[], step: number): string {
  const node = proofPath.find(n => n.step === step)
  if (!node) return ''
  switch (node.role) {
    case 'leaf': return 'Hashing the selected oracle\'s leaf data'
    case 'sibling': return 'Sibling hash provided by the proof'
    case 'computed': return 'Combining the pair below into a parent hash'
    case 'root': return 'Root reached — membership verified!'
  }
}

export function MerkleExplorer() {
  const { wallet } = useParams<{ wallet: string }>()
  const [data, setData] = useState<MerkleData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeaf, setSelectedLeaf] = useState<number | null>(null)
  const [proof, setProof] = useState<{ root: string; proof: string[]; leaf: LeafData; leaf_index: number } | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [proofPath, setProofPath] = useState<ProofPathNode[] | null>(null)
  const [animStep, setAnimStep] = useState(-1)
  const [isAnimating, setIsAnimating] = useState(false)
  const treeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wallet) return
    setIsLoading(true)
    fetch(`${API_URL}/api/merkle/owner/${wallet}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [wallet])

  const emptyTree: TreeResult = { layers: [], leafNames: new Map(), leafIndexMap: new Map(), flatTree: [], valueMap: [] }
  const treeResult = useMemo(() => {
    if (!data?.leaves?.length) return emptyTree
    try {
      return computeTreeLayers(data.leaves)
    } catch {
      return emptyTree
    }
  }, [data])

  const { layers: treeLayers, leafNames, leafIndexMap, flatTree, valueMap } = treeResult

  // Compute proof path when proof data arrives — show full path instantly
  useEffect(() => {
    if (proof && flatTree.length > 0 && valueMap.length > 0) {
      const path = computeProofPath(flatTree, valueMap, proof.leaf_index, treeLayers)
      setProofPath(path)
      // Show all nodes immediately (no animation)
      setAnimStep(path.length > 0 ? Math.max(...path.map(n => n.step)) : -1)
      setIsAnimating(false)
    } else {
      setProofPath(null)
      setAnimStep(-1)
      setIsAnimating(false)
    }
  }, [proof, flatTree, valueMap, treeLayers])

  // Auto-advance animation
  useEffect(() => {
    if (!isAnimating || !proofPath) return
    const maxStep = Math.max(...proofPath.map(n => n.step))
    if (animStep >= maxStep) {
      setIsAnimating(false)
      return
    }
    const timer = setTimeout(() => setAnimStep(s => s + 1), 800)
    return () => clearTimeout(timer)
  }, [isAnimating, animStep, proofPath])

  const maxStep = proofPath ? Math.max(...proofPath.map(n => n.step)) : 0

  /** Select an oracle by index — fetches proof and resets animation */
  const selectOracle = (idx: number) => {
    if (!wallet || !data) return
    setSelectedLeaf(idx)
    setProof(null)
    setProofPath(null)
    setAnimStep(-1)
    setIsAnimating(false)
    const leaf = data.leaves[idx]
    setProofLoading(true)
    fetch(`${API_URL}/api/merkle/proof/${wallet}/${leaf.issue_number}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setProof(d) })
      .catch(() => {})
      .finally(() => setProofLoading(false))
  }

  /** Get highlight class for a tree node based on proof path */
  const getNodeHighlight = (depth: number, position: number): { className: string; isActive: boolean } | null => {
    if (!proofPath || animStep < 0) return null
    const node = proofPath.find(n => n.layer === depth && n.position === position)
    if (!node || node.step > animStep) return null

    const isActive = node.step === animStep
    let className = ''

    switch (node.role) {
      case 'leaf':
        className = 'ring-2 ring-emerald-400 bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
        break
      case 'sibling':
        className = 'ring-2 ring-amber-400 bg-amber-500/20 border-amber-500/50 text-amber-300'
        break
      case 'computed':
        className = 'ring-2 ring-orange-400 bg-orange-500/20 border-orange-500/50 text-orange-300'
        break
      case 'root':
        className = 'ring-2 ring-emerald-400 bg-emerald-500/20 border-emerald-500/50 text-emerald-300 glow-pulse-emerald'
        break
    }

    return { className, isActive }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <TreePine className="h-12 w-12 text-slate-600 mx-auto" />
        <h1 className="mt-4 text-xl font-bold text-white">Merkle tree not found</h1>
        <p className="mt-2 text-slate-400">{error || 'No data available'}</p>
      </div>
    )
  }

  const shortWallet = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : ''

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TreePine className="h-6 w-6 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Merkle Tree Explorer</h1>
        </div>
        <p className="text-slate-400">
          Oracle family tree for{' '}
          <Link to={`/u/${checksumAddress(wallet!)}`} className="text-orange-400 hover:text-orange-300 font-mono">
            {shortWallet}
          </Link>
        </p>
      </div>

      {/* Root */}
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-bold text-orange-400">Root</h2>
        </div>
        <div className="font-mono text-sm text-white break-all bg-slate-800/50 rounded-lg p-3">
          {data.merkle_root}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Computed from {data.oracle_count} oracle{data.oracle_count !== 1 ? 's' : ''} using OpenZeppelin StandardMerkleTree
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">How is the root computed?</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">1</span>
            <p>Each oracle becomes a <strong className="text-white">leaf</strong>: the bot wallet address, birth issue URL, and issue number are ABI-encoded together.</p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">2</span>
            <p>Each leaf is hashed with <code className="text-orange-300 bg-slate-800 px-1.5 py-0.5 rounded">keccak256(abi.encode(address, string, uint256))</code></p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">3</span>
            <p>Pairs of hashes are <strong className="text-white">sorted</strong> and combined: <code className="text-orange-300 bg-slate-800 px-1.5 py-0.5 rounded">keccak256(sort(left, right))</code></p>
          </div>
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400">4</span>
            <p>This repeats up the tree until a single <strong className="text-orange-400">root hash</strong> remains. Anyone can verify an oracle belongs to this family using a Merkle proof.</p>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 text-xs text-slate-400">
          Leaf encoding: <code className="text-slate-300">[address, string, uint256]</code> — sorted by issue number for deterministic ordering
        </div>
      </div>

      {/* Tree visualization */}
      {treeLayers.length > 0 && (
        <div ref={treeRef} className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Tree Structure</h2>
          {/* Proof path legend */}
          {proofPath && animStep >= 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-2 ring-emerald-400 bg-emerald-500/20" /> Leaf</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-2 ring-amber-400 bg-amber-500/20" /> Sibling</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-2 ring-orange-400 bg-orange-500/20" /> Computed</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-2 ring-emerald-400 bg-emerald-500/20 glow-pulse-emerald" /> Root</span>
            </div>
          )}
          <div className="space-y-2 overflow-x-auto">
            {treeLayers.map((layer, depth) => (
              <div key={depth}>
                {depth > 0 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-slate-600" />
                  </div>
                )}
                <div className="flex justify-center gap-2 flex-wrap">
                  {layer.map((hash: string, i: number) => {
                    const isLeaf = depth === treeLayers.length - 1
                    const name = isLeaf ? leafNames.get(hash) : null
                    const highlight = getNodeHighlight(depth, i)
                    const clickableIdx = isLeaf ? leafIndexMap.get(hash) : undefined
                    return (
                      <div
                        key={highlight?.isActive ? `${i}-${animStep}` : i}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                          highlight
                            ? `${highlight.className}${highlight.isActive ? ' proof-activate' : ''} font-mono`
                            : depth === 0
                              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 font-mono'
                              : isLeaf
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 cursor-pointer hover:scale-110 hover:bg-purple-500/25 hover:border-purple-400 hover:text-white hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                              : 'bg-slate-800/50 border-slate-700 text-slate-400 font-mono'
                        }`}
                        title={isLeaf ? `Click to verify ${name || hash}` : hash}
                        onClick={clickableIdx !== undefined ? () => selectOracle(clickableIdx) : undefined}
                      >
                        {name || shortHash(hash)}
                      </div>
                    )
                  })}
                </div>
                <div className="text-center text-[10px] text-slate-600 mt-1">
                  {depth === 0 ? 'Root' : depth === treeLayers.length - 1 ? `Leaves (${layer.length})` : `Level ${depth}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verify Membership */}
      {data.leaves.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Verify Membership
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Select an oracle to generate a Merkle proof — a cryptographic checklist that proves this oracle belongs to the family tree.
          </p>

          {/* Oracle selector */}
          <div className="relative mb-4">
            <select
              value={selectedLeaf ?? ''}
              onChange={(e) => {
                const idx = e.target.value === '' ? null : Number(e.target.value)
                if (idx !== null) {
                  selectOracle(idx)
                } else {
                  setSelectedLeaf(null)
                  setProof(null)
                  setProofPath(null)
                  setAnimStep(-1)
                  setIsAnimating(false)
                }
              }}
              className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 pr-10 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Choose an oracle to verify...</option>
              {data.leaves.map((leaf, i) => (
                <option key={i} value={i}>
                  {leaf.oracle_name || `Oracle #${leaf.issue_number}`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Proof loading */}
          {proofLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating proof...
            </div>
          )}

          {/* Animation controls */}
          {proofPath && proofPath.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (isAnimating) {
                      setIsAnimating(false)
                    } else if (animStep >= 0 && animStep < maxStep) {
                      // Resume mid-animation
                      setIsAnimating(true)
                    } else {
                      // Start/restart from beginning
                      setAnimStep(0)
                      setIsAnimating(true)
                      treeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isAnimating ? 'Pause' : animStep >= 0 && animStep < maxStep ? 'Resume' : 'Watch Verification'}
                </button>

                {animStep >= 0 && (
                  <>
                    <button
                      onClick={() => { setIsAnimating(false); setAnimStep(s => Math.max(0, s - 1)) }}
                      disabled={animStep <= 0}
                      className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-slate-400 w-20 text-center">
                      Step {animStep + 1} / {maxStep + 1}
                    </span>
                    <button
                      onClick={() => { setIsAnimating(false); setAnimStep(s => Math.min(maxStep, s + 1)) }}
                      disabled={animStep >= maxStep}
                      className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {animStep >= 0 && (
                <p className="mt-2 text-sm text-slate-400">
                  {getStepDescription(proofPath, animStep)}
                </p>
              )}
            </div>
          )}

          {/* Proof result */}
          {proof && selectedLeaf !== null && (
            <div className="space-y-3">
              {/* Checklist */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                {/* Check 1: Leaf data */}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Leaf Data</div>
                    <div className="text-xs text-slate-400 space-y-0.5 mt-1">
                      <div><span className="text-slate-500">address:</span> <span className="font-mono text-slate-300">{proof.leaf.bot_wallet}</span></div>
                      <div><span className="text-slate-500">string:</span> <span className="font-mono text-slate-300 break-all">{proof.leaf.birth_issue}</span></div>
                      <div><span className="text-slate-500">uint256:</span> <span className="font-mono text-slate-300">{proof.leaf.issue_number}</span></div>
                    </div>
                  </div>
                </div>

                {/* Check 2: Leaf hash */}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Leaf Hash (keccak256)</div>
                    <div className="text-xs font-mono text-slate-300 mt-1">Leaf index: {proof.leaf_index}</div>
                  </div>
                </div>

                {/* Check 3: Proof path */}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">Proof Path ({proof.proof.length} siblings)</div>
                    <div className="mt-2 space-y-1.5">
                      {proof.proof.map((hash, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-12 shrink-0">Step {i + 1}</span>
                          <div className="font-mono text-xs text-slate-300 bg-slate-900/50 px-2 py-1 rounded truncate flex-1" title={hash}>
                            {hash}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Check 4: Root match */}
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">Root Verified</div>
                    <div className="text-xs mt-1">
                      <span className="text-slate-500">Computed root matches: </span>
                      <span className="font-mono text-emerald-400">{shortHash(proof.root)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification badge */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  {data.leaves[selectedLeaf]?.oracle_name || 'Oracle'} is a verified member of this family tree
                </span>
              </div>

              {/* On-chain note */}
              <div className="text-xs text-slate-500 px-1">
                This proof can be verified on-chain by any smart contract using OpenZeppelin MerkleProof.verify()
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaves detail */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-purple-400" />
          Leaves ({data.oracle_count})
        </h2>
        <div className="space-y-3">
          {data.leaves.map((leaf, i) => (
            <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                      {i}
                    </span>
                    <span className="font-medium text-white truncate">{leaf.oracle_name || `Oracle #${leaf.issue_number}`}</span>
                    <a
                      href={leaf.birth_issue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-white transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-20 shrink-0">Bot wallet</span>
                      <span className="font-mono text-slate-300 truncate">{leaf.bot_wallet}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-20 shrink-0">Birth issue</span>
                      <span className="font-mono text-slate-300 truncate">{leaf.birth_issue}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-20 shrink-0">Issue #</span>
                      <span className="font-mono text-slate-300">{leaf.issue_number}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-2 rounded bg-slate-900/50 text-[10px] font-mono text-slate-500 break-all">
                leaf = keccak256(abi.encode({leaf.bot_wallet.toLowerCase()}, "{leaf.birth_issue}", {leaf.issue_number}))
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
