import { useState } from 'react'
import { Fingerprint, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react'
import { recoverMessageAddress } from 'viem'

interface Web3ProofProps {
  signature: string
  message?: string
  signerWallet: string
}

export function Web3Proof({ signature, message, signerWallet }: Web3ProofProps) {
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle')
  const [recoveredAddr, setRecoveredAddr] = useState<string | null>(null)

  const handleVerify = async () => {
    if (!message) return
    setVerifyState('verifying')
    try {
      const recovered = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      })
      setRecoveredAddr(recovered)
      setVerifyState(recovered.toLowerCase() === signerWallet.toLowerCase() ? 'valid' : 'invalid')
    } catch {
      setVerifyState('invalid')
      setRecoveredAddr(null)
    }
  }

  return (
    <details className="mt-4 rounded-lg border border-slate-700/50 bg-slate-800/30">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-orange-400">
        <Fingerprint className="h-3.5 w-3.5" />
        <span>Web3 Proof · {signature.slice(0, 10)}...{signature.slice(-8)}</span>
      </summary>
      <div className="border-t border-slate-700/50 px-3 py-2 font-mono text-xs text-slate-500">
        <div className="mb-2"><span className="text-slate-400">Signer:</span> {signerWallet}</div>
        <div className="mb-1"><span className="text-slate-400">Signature:</span></div>
        <div className="mb-2 break-all text-[10px] leading-relaxed text-orange-400/70">{signature}</div>
        {message && (
          <>
            <div className="mb-1"><span className="text-slate-400">Signed Payload:</span></div>
            <pre className="whitespace-pre-wrap break-all text-[10px] leading-relaxed rounded bg-slate-900/50 p-2">{(() => {
              try { return JSON.stringify(JSON.parse(message), null, 2) } catch { return message }
            })()}</pre>
          </>
        )}
        <div className="mt-3 border-t border-slate-700/50 pt-3">
          {verifyState === 'idle' && (
            <button
              onClick={handleVerify}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <Search className="h-3 w-3" />
              Verify Proof
            </button>
          )}
          {verifyState === 'verifying' && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Recovering signer...
            </div>
          )}
          {verifyState === 'valid' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Signature valid — signer matches author
              </div>
              {recoveredAddr && (
                <div className="text-[10px] text-slate-500">Recovered: {recoveredAddr}</div>
              )}
            </div>
          )}
          {verifyState === 'invalid' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                Verification failed — signer does not match
              </div>
              {recoveredAddr && (
                <div className="text-[10px] text-slate-500">Recovered: {recoveredAddr}</div>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-slate-700/50 pt-2 text-[10px] text-slate-600">
          <span className="text-slate-500">CLI verify:</span>{' '}
          <code className="select-all break-all">cast wallet verify --address {signerWallet} '{message}' "{signature}"</code>
        </div>
      </div>
    </details>
  )
}
