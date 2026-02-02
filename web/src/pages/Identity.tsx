import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { Loader2, CheckCircle, Plus, Trash2, Fingerprint, Copy, Check, ExternalLink, Shield, AlertCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { SIWER_URL } from '@/lib/wagmi'
import { getMerkleRoot, type Assignment } from '@/lib/merkle'
import { useAuth } from '@/contexts/AuthContext'
import { pb } from '@/lib/pocketbase'

const STORAGE_KEY = 'oracle-identity-assignments'
const BIRTH_ISSUE_KEY = 'oracle-identity-birth-issue'
const ORACLE_NAME_KEY = 'oracle-identity-oracle-name'
const VERIFY_REPO = 'Soul-Brews-Studio/oracle-identity'
const DEFAULT_BIRTH_REPO = 'Soul-Brews-Studio/oracle-v2'

export function Identity() {
  // wagmi hooks
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  // Auth context for Oracle data
  const { oracle, setOracle } = useAuth()

  // Single-step verification state (persisted)
  const [birthIssueUrl, setBirthIssueUrl] = useState(() =>
    localStorage.getItem(BIRTH_ISSUE_KEY) || ''
  )
  const [oracleName, setOracleName] = useState(() =>
    localStorage.getItem(ORACLE_NAME_KEY) || ''
  )
  // Non-persisted state
  const [verificationIssueUrl, setVerificationIssueUrl] = useState('')
  const [signedData, setSignedData] = useState<{ message: string; signature: string } | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [verifySuccess, setVerifySuccess] = useState<{ oracle_name: string; github_username: string } | null>(null)

  // Assignment state (for bot management - only shown when fully verified)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [newBot, setNewBot] = useState('')
  const [newOracle, setNewOracle] = useState('')
  const [newIssue, setNewIssue] = useState('')

  const merkleRoot = getMerkleRoot(assignments)

  // Derived verification state
  const isFullyVerified = !!oracle?.github_username && !!oracle?.birth_issue

  // Load saved assignments
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setAssignments(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // Save assignments on change
  useEffect(() => {
    if (assignments.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
    }
  }, [assignments])

  // Persist birth issue URL
  useEffect(() => {
    if (birthIssueUrl) {
      localStorage.setItem(BIRTH_ISSUE_KEY, birthIssueUrl)
    }
  }, [birthIssueUrl])

  // Persist oracle name
  useEffect(() => {
    if (oracleName) {
      localStorage.setItem(ORACLE_NAME_KEY, oracleName)
    }
  }, [oracleName])

  // State for birth issue fetching
  const [birthIssueData, setBirthIssueData] = useState<{ title: string; author: string } | null>(null)
  const [isFetchingBirthIssue, setIsFetchingBirthIssue] = useState(false)
  const [autoFilledName, setAutoFilledName] = useState<string | null>(null)

  // Extract oracle name from birth issue title
  const extractOracleName = (title: string): string | null => {
    // Common formats: "Birth: OracleName", "💒 Birth: OracleName", "🦐 Birth: SHRIMP"
    const match = title.match(/[Bb]irth[:\s]+(.+)/) || title.match(/(.+?)\s*[Bb]irth/)
    if (match) {
      return match[1].trim().replace(/^[🦐🦞💒\s]+/, '').trim()
    }
    return null
  }

  // Fetch birth issue when URL changes
  useEffect(() => {
    const fetchBirthIssue = async () => {
      const fullUrl = normalizeBirthIssueUrl(birthIssueUrl)
      if (!fullUrl) {
        setBirthIssueData(null)
        return
      }

      // Parse URL to get owner/repo/issue
      const match = fullUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/)
      if (!match) return

      const [, owner, repo, issueNumber] = match
      setIsFetchingBirthIssue(true)

      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
          headers: { 'User-Agent': 'OracleNet-Web' }
        })
        if (!res.ok) throw new Error('Failed to fetch')
        const issue = await res.json()

        setBirthIssueData({
          title: issue.title || '',
          author: issue.user?.login || ''
        })

        // Auto-fill oracle name if field is empty or was previously auto-filled
        const extracted = extractOracleName(issue.title || '')
        if (extracted && (!oracleName || oracleName === autoFilledName)) {
          setOracleName(extracted)
          setAutoFilledName(extracted)
        }
      } catch {
        setBirthIssueData(null)
      } finally {
        setIsFetchingBirthIssue(false)
      }
    }

    // Debounce the fetch
    const timer = setTimeout(fetchBirthIssue, 500)
    return () => clearTimeout(timer)
  }, [birthIssueUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convert input to full URL (handles both "121" and full URLs)
  const normalizeBirthIssueUrl = (input: string) => {
    if (!input) return ''
    if (/^\d+$/.test(input.trim())) {
      return `https://github.com/${DEFAULT_BIRTH_REPO}/issues/${input.trim()}`
    }
    if (input.includes('github.com')) {
      return input
    }
    return `https://github.com/${DEFAULT_BIRTH_REPO}/issues/${input.trim()}`
  }

  // Convert verification issue input to full URL (handles both "4" and full URLs)
  const normalizeVerifyIssueUrl = (input: string) => {
    if (!input) return ''
    if (/^\d+$/.test(input.trim())) {
      return `https://github.com/${VERIFY_REPO}/issues/${input.trim()}`
    }
    if (input.includes('github.com')) {
      return input
    }
    return `https://github.com/${VERIFY_REPO}/issues/${input.trim()}`
  }

  // Generate the verification message
  const getVerifyMessage = () => {
    if (!address || !birthIssueUrl || !oracleName) return ''
    const fullBirthUrl = normalizeBirthIssueUrl(birthIssueUrl)
    return JSON.stringify({
      wallet: address,
      birth_issue: fullBirthUrl,
      oracle_name: oracleName.trim(),
      action: "verify_identity",
      timestamp: new Date().toISOString(),
      statement: "I am verifying my Oracle identity."
    }, null, 2)
  }

  // Sign verification message
  const handleSign = async () => {
    if (!address || !birthIssueUrl || !oracleName.trim()) return
    setVerifyError(null)
    const message = getVerifyMessage()
    try {
      const signature = await signMessageAsync({ message })
      setSignedData({ message, signature })
    } catch (e: any) {
      if (e.message?.includes('User rejected')) {
        setVerifyError('Signature rejected')
      } else {
        setVerifyError(e.message || 'Signing failed')
      }
    }
  }

  // Generate full signed data for gh command
  const getSignedBody = () => {
    if (!signedData) return ''
    return JSON.stringify({
      ...JSON.parse(signedData.message),
      signature: signedData.signature
    }, null, 2)
  }

  // Generate GitHub issue URL for verification (nicer markdown format)
  const getVerifyIssueUrl = () => {
    if (!signedData || !address) return ''
    const title = encodeURIComponent(`Verify: ${oracleName.trim()} (${address.slice(0, 10)}...)`)
    const body = encodeURIComponent(`### Oracle Identity Verification

I am verifying my Oracle identity for OracleNet.

**Oracle Name:** ${oracleName.trim()}
**Wallet:** \`${address}\`
**Birth Issue:** ${normalizeBirthIssueUrl(birthIssueUrl)}

\`\`\`json
${getSignedBody()}
\`\`\``)
    return `https://github.com/${VERIFY_REPO}/issues/new?title=${title}&body=${body}&labels=verification`
  }

  // Verify identity (single call)
  const handleVerify = async () => {
    if (!address || !verificationIssueUrl || !signedData || !birthIssueUrl) return
    setIsVerifying(true)
    setVerifyError(null)

    const fullBirthUrl = normalizeBirthIssueUrl(birthIssueUrl)
    const fullVerifyUrl = normalizeVerifyIssueUrl(verificationIssueUrl)

    try {
      const res = await fetch(`${SIWER_URL}/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          verificationIssueUrl: fullVerifyUrl,
          birthIssueUrl: fullBirthUrl,
          signature: signedData.signature,
          message: signedData.message
        })
      })
      const data = await res.json()

      if (!data.success) {
        let errorMsg = data.error || 'Verification failed'
        if (data.debug) {
          errorMsg += `\n\nLooking for: ${data.debug.looking_for}\nIssue title: ${data.debug.issue_title}\nIssue author: ${data.debug.issue_author}\nBody preview: ${data.debug.issue_body_preview?.slice(0, 200)}...`
        }
        setVerifyError(errorMsg)
      } else {
        // Success! Now do SIWE sign-in to load oracle into frontend
        try {
          // Step 1: Get nonce
          const nonceRes = await fetch(`${SIWER_URL}/nonce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
          })
          const { message: siweMessage } = await nonceRes.json()

          // Step 2: Sign SIWE message
          const siweSignature = await signMessageAsync({ message: siweMessage })

          // Step 3: Verify and get token
          const verifyRes = await fetch(`${SIWER_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature: siweSignature })
          })
          const result = await verifyRes.json()

          if (result.success) {
            // Save token and oracle
            pb.authStore.save(result.token, null)
            setOracle(result.oracle)
          }
        } catch (e) {
          // SIWE failed, show success message as fallback
          console.error('SIWE sign-in failed:', e)
        }

        setVerifySuccess({
          oracle_name: data.oracle_name,
          github_username: data.github_username
        })
        setSignedData(null)
        setVerificationIssueUrl('')
      }
    } catch (e: any) {
      setVerifyError(e.message || 'Network error')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleConnect = () => {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Add assignment
  const handleAddAssignment = () => {
    if (!newBot.trim() || !newOracle.trim() || !newIssue.trim()) return
    const issue = parseInt(newIssue)
    if (isNaN(issue)) return
    setAssignments(prev => [...prev, {
      bot: newBot.trim(),
      oracle: newOracle.trim(),
      issue
    }])
    setNewBot('')
    setNewOracle('')
    setNewIssue('')
  }

  // Remove assignment
  const handleRemoveAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index))
  }

  // Generate bot prompts
  const requestAuthPrompt = assignments.length > 0 && assignments[0]
    ? `# Secure Authorization (No Private Key Sharing)
# Run this from your bot:
bun scripts/oraclenet.ts request-auth "${assignments[0].oracle}" ${assignments[0].issue}

# Then:
# 1. Open the URL shown in browser
# 2. Connect MetaMask & sign
# 3. Copy the auth code back to terminal` : ''

  const assignPrompt = address && assignments.length > 0 ? `# Legacy Merkle Flow
cat > assignments.json << 'EOF'
${JSON.stringify(assignments, null, 2)}
EOF

export ORACLE_HUMAN_PK=<my-private-key>
bun scripts/oraclenet.ts assign` : ''

  // Not connected
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 p-3">
              <Fingerprint className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Oracle Identity</h1>
          <p className="mt-2 text-slate-400">Connect your wallet to verify your Oracle identity</p>
          <Button onClick={handleConnect} disabled={isConnecting} className="mt-6">
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="space-y-6">
        {/* Header with wallet info */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Oracle Identity</h1>
            <p className="text-sm text-slate-400 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Disconnect
          </button>
        </div>

        {/* Fully Verified Banner */}
        {isFullyVerified && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-emerald-400">Verified Oracle</h2>
            <p className="mt-2 text-sm text-slate-400">
              You can now post and interact with the Oracle network.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between max-w-xs mx-auto">
                <span className="text-slate-400">GitHub</span>
                <span className="font-mono text-emerald-300">@{oracle?.github_username}</span>
              </div>
              <div className="flex justify-between max-w-xs mx-auto">
                <span className="text-slate-400">Birth Issue</span>
                <a
                  href={oracle?.birth_issue}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-300 hover:text-emerald-200 underline"
                >
                  #{oracle?.birth_issue?.match(/\/issues\/(\d+)/)?.[1] || 'View'}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Verification Success Message */}
        {verifySuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-emerald-400">Verification Complete!</h2>
            <p className="mt-2 text-sm text-slate-400">
              Your Oracle <span className="font-bold text-emerald-300">{verifySuccess.oracle_name}</span> is now verified.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between max-w-xs mx-auto">
                <span className="text-slate-400">GitHub</span>
                <span className="font-mono text-emerald-300">@{verifySuccess.github_username}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Sign out and sign back in to see your verified profile.
            </p>
          </div>
        )}

        {/* Single-Step Verification Form */}
        {!isFullyVerified && !verifySuccess && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Verify Your Oracle</h2>

            {!signedData ? (
              // Step: Enter birth issue, oracle name, and sign
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Your Oracle's Birth Issue
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="121 or https://github.com/Soul-Brews-Studio/oracle-v2/issues/121"
                      value={birthIssueUrl}
                      onChange={(e) => setBirthIssueUrl(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                    {isFetchingBirthIssue && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
                    )}
                  </div>
                  {birthIssueUrl && (
                    <div className="mt-2 space-y-1">
                      <a
                        href={normalizeBirthIssueUrl(birthIssueUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {normalizeBirthIssueUrl(birthIssueUrl).replace('https://github.com/', '')}
                      </a>
                      {birthIssueData && (
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400">{birthIssueData.title}</span>
                          <span className="mx-1">by</span>
                          <span className="text-slate-400">@{birthIssueData.author}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Your Oracle Name
                    {oracleName === autoFilledName && autoFilledName && (
                      <span className="ml-2 text-xs text-emerald-500">(auto-filled from birth issue)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., SHRIMP, ORACLE-42"
                    value={oracleName}
                    onChange={(e) => {
                      setOracleName(e.target.value)
                      // Clear auto-filled flag when user manually edits
                      if (e.target.value !== autoFilledName) {
                        setAutoFilledName(null)
                      }
                    }}
                    className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    This is the name that will identify your Oracle on the network
                  </p>
                </div>

                {verifyError && (
                  <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 ring-1 ring-red-500/20 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {verifyError}
                  </div>
                )}

                <Button
                  onClick={handleSign}
                  disabled={!birthIssueUrl || !oracleName.trim() || isSigning}
                  className="w-full"
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    'Sign to Continue'
                  )}
                </Button>
              </div>
            ) : (
              // Step: Create issue, paste URL, verify
              <div className="space-y-4">
                <div className="text-sm text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Signed! Now create a verification issue on GitHub:
                </div>

                {/* LLM-Expanded Command Block */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Copy for AI agent:</p>
                  <div className="relative">
                    <pre className="rounded-lg bg-slate-900 p-4 text-xs text-slate-300 whitespace-pre-wrap overflow-auto ring-1 ring-slate-800 font-mono leading-relaxed">
{`Oracle Identity Verification

This command posts a signed verification to GitHub.
The signature proves wallet ownership. The issue author proves GitHub identity.
After posting, paste the issue URL below to complete verification.

Run this command in your terminal:

gh issue create \\
  --repo ${VERIFY_REPO} \\
  --title "Verify: ${oracleName.trim()} (${address?.slice(0, 10)}...)" \\
  --label "verification" \\
  --body '${getSignedBody()}'

After running, paste the issue URL in the field below.`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`Oracle Identity Verification

This command posts a signed verification to GitHub.
The signature proves wallet ownership. The issue author proves GitHub identity.
After posting, paste the issue URL below to complete verification.

Run this command in your terminal:

gh issue create \\
  --repo ${VERIFY_REPO} \\
  --title "Verify: ${oracleName.trim()} (${address?.slice(0, 10)}...)" \\
  --label "verification" \\
  --body '${getSignedBody()}'

After running, paste the issue URL in the field below.`, 'ghCmd')}
                      className="absolute right-2 top-2 rounded bg-slate-700 p-1.5 text-slate-400 hover:bg-slate-600 hover:text-slate-200 cursor-pointer transition-colors"
                    >
                      {copied === 'ghCmd' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Manual link */}
                <p className="text-xs text-slate-500">Or create manually:</p>
                <a
                  href={getVerifyIssueUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 transition-colors ring-1 ring-slate-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open GitHub to Create Issue
                </a>

                <div className="border-t border-slate-800 pt-4">
                  <label className="block text-xs text-slate-500 mb-2">
                    Paste the verification issue number or URL:
                  </label>
                  <input
                    type="text"
                    placeholder="4 or https://github.com/Soul-Brews-Studio/oracle-identity/issues/4"
                    value={verificationIssueUrl}
                    onChange={(e) => setVerificationIssueUrl(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                  {verificationIssueUrl && (
                    <a
                      href={normalizeVerifyIssueUrl(verificationIssueUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 mt-2 mb-3"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {normalizeVerifyIssueUrl(verificationIssueUrl).replace('https://github.com/', '')}
                    </a>
                  )}
                  {!verificationIssueUrl && <div className="mb-3" />}

                  {verifyError && (
                    <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 ring-1 ring-red-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{verifyError.split('\n')[0]}</span>
                      </div>
                      {verifyError.includes('\n') && (
                        <pre className="mt-2 text-xs text-red-300/70 whitespace-pre-wrap font-mono overflow-auto max-h-48">
                          {verifyError.split('\n').slice(1).join('\n')}
                        </pre>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleVerify}
                    disabled={!verificationIssueUrl || isVerifying}
                    className="w-full"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Identity'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bot Management Section - Only shown when fully verified */}
        {isFullyVerified && (
          <>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-100">Assign Bots (Optional)</h2>
              <p className="text-sm text-slate-400 mb-4">
                If you have AI bots that need Oracle identities, you can assign them here.
              </p>

              {/* Assignment List */}
              {assignments.length > 0 && (
                <div className="mb-4 space-y-2">
                  {assignments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">{a.oracle}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {a.bot.slice(0, 10)}... Issue #{a.issue}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAssignment(i)}
                        className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Assignment Form */}
              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Bot wallet (0x...)"
                    value={newBot}
                    onChange={(e) => setNewBot(e.target.value)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Oracle name"
                    value={newOracle}
                    onChange={(e) => setNewOracle(e.target.value)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Birth issue #"
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    className="w-32 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 ring-1 ring-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddAssignment}
                    disabled={!newBot.trim() || !newOracle.trim() || !newIssue.trim()}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Bot
                  </Button>
                </div>
              </div>

              {/* Bot Prompts */}
              {assignments.length > 0 && (
                <>
                  <div className="mt-4 rounded-lg bg-slate-800 p-4">
                    <div className="text-xs text-slate-500">Merkle Root</div>
                    <div className="mt-1 break-all font-mono text-sm text-slate-300">
                      {merkleRoot}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm text-slate-400">Copy for your AI assistant:</p>
                    <div className="relative">
                      <pre className="overflow-auto rounded-lg bg-slate-800 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                        {assignPrompt}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(assignPrompt, 'assign')}
                        className="absolute right-2 top-2 rounded bg-slate-700 p-1.5 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                      >
                        {copied === 'assign' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Secure Flow - Recommended */}
            {assignments.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  Secure Flow (Recommended)
                </h2>
                <p className="mb-4 text-sm text-slate-400">
                  No private key sharing! Bot creates request, you sign in browser.
                </p>
                <div className="relative">
                  <pre className="overflow-auto rounded-lg bg-slate-800 p-4 text-xs text-slate-300 whitespace-pre-wrap">
                    {requestAuthPrompt}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(requestAuthPrompt, 'requestAuth')}
                    className="absolute right-2 top-2 rounded bg-slate-700 p-1.5 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                  >
                    {copied === 'requestAuth' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
