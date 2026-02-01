# SIWE Authentication for OracleNet

## TL;DR

> **Quick Summary**: Add Sign In With Ethereum (SIWE) as alternative auth with wallet whitelist for auto-approval
> 
> **Deliverables**:
> - SIWE nonce/verify endpoints in Go backend
> - Wallet whitelist collection for auto-approval
> - Viem + SIWE frontend integration
> - Wallet connect button on Login page
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves (backend, then frontend)

---

## TODOs

- [ ] 1. Add SIWE migration (`migrations/1706745603_add_siwe.go`)
  - Add `wallet_address` field to oracles
  - Create `approved_wallets` collection
  - Create `siwe_nonces` collection
  - **Category**: quick

- [ ] 2. Add go-ethereum dependency
  - `go get github.com/ethereum/go-ethereum`
  - **Category**: quick

- [ ] 3. Implement SIWE routes (`hooks/siwe.go`)
  - GET /api/auth/siwe/nonce
  - POST /api/auth/siwe/verify
  - EIP-191 signature recovery
  - Auto-approve whitelisted addresses
  - **Category**: unspecified-high

- [ ] 4. Add viem frontend dependencies
  - `npm install viem wagmi @tanstack/react-query`
  - Create wagmi config
  - **Category**: quick

- [ ] 5. Create WalletConnect component
  - Connect wallet button
  - SIWE message signing
  - Update AuthContext on success
  - **Category**: visual-engineering
  - **Skills**: frontend-ui-ux

- [ ] 6. Update Login page
  - Add wallet connect option
  - Wrap app with WagmiProvider
  - **Category**: visual-engineering

- [ ] 7. Deploy and test
  - Push to GitHub
  - Test SIWE flow end-to-end
  - **Category**: quick

---

## Key Files to Create/Modify

### Backend
- `migrations/1706745603_add_siwe.go` - New collections
- `hooks/siwe.go` - SIWE routes (NEW)
- `main.go` - Call BindSIWERoutes
- `go.mod` - Add go-ethereum

### Frontend
- `web/src/lib/wagmi.ts` - Wagmi config (NEW)
- `web/src/components/WalletConnect.tsx` - Wallet UI (NEW)
- `web/src/pages/Login.tsx` - Add wallet option
- `web/src/main.tsx` - WagmiProvider wrapper

---

## API Endpoints

### GET /api/auth/siwe/nonce
Returns: `{"nonce": "abc123...", "expiresAt": "2026-02-01T..."}`

### POST /api/auth/siwe/verify
Body: `{"message": "...", "signature": "0x..."}`
Returns: `{"success": true, "token": "...", "record": {...}, "isWhitelisted": bool}`

---

## Success Criteria

- [ ] Nonce endpoint works
- [ ] Verify creates oracle with wallet_address
- [ ] Whitelisted addresses auto-approved
- [ ] Login page shows wallet option
- [ ] End-to-end flow works
