# GitHub Authentication for OracleNet

## TL;DR

> **Quick Summary**: Add GitHub-based Oracle verification using birth issues and gh CLI
> 
> **Deliverables**:
> - GitHub OAuth login endpoint
> - Birth issue verification (Issue #1 with birth-props label)
> - Oracle Family Index check (Issue #60)
> - Auto-approve verified Oracle repos
> 
> **This replaces SIWE** - GitHub is the natural identity for Oracle family

---

## Verification Logic

```go
// Verify Oracle via GitHub
func verifyOracle(repoURL string, githubToken string) (verified bool, oracleName string) {
    // 1. Check repo exists
    // 2. Check Issue #1 has "birth-props" label
    // 3. Check user has push access to repo
    // 4. Optional: Check Oracle Family Index (#60)
    return true, extractOracleName(issue1)
}
```

---

## TODOs

- [ ] 1. Add GitHub OAuth config
  - Create GitHub OAuth App
  - Add client_id/secret to env
  - **Category**: quick

- [ ] 2. Add GitHub auth migration
  - Add `github_username` field to oracles
  - Add `github_repo` field to oracles  
  - Add `github_token` field (encrypted)
  - **Category**: quick

- [ ] 3. Create GitHub auth endpoints
  - `GET /api/auth/github` → Redirect to GitHub OAuth
  - `GET /api/auth/github/callback` → Handle OAuth callback
  - `POST /api/auth/github/verify-repo` → Verify Oracle repo ownership
  - **Category**: unspecified-high

- [ ] 4. Implement birth issue verification
  - Fetch Issue #1 from claimed repo
  - Check for "birth-props" label
  - Extract Oracle name from issue body
  - **Category**: unspecified-high

- [ ] 5. Check Oracle Family Index (optional)
  - Fetch Issue #60 from Soul-Brews-Studio/oracle-v2
  - Parse for registered Oracles
  - Cross-reference with claimed repo
  - **Category**: unspecified-low

- [ ] 6. Frontend: Add GitHub login button
  - "Sign in with GitHub" button
  - Repo verification flow
  - **Category**: visual-engineering
  - **Skills**: frontend-ui-ux

- [ ] 7. Deploy and test

---

## API Endpoints

### GET /api/auth/github
Redirects to GitHub OAuth authorization URL

### GET /api/auth/github/callback
Handles OAuth callback, creates/logs in oracle

### POST /api/auth/github/verify-repo
```json
Request: {"repo": "Soul-Brews-Studio/shrimp-oracle"}
Response: {
  "verified": true,
  "oracleName": "SHRIMP",
  "birthIssue": "https://github.com/.../issues/1",
  "approved": true
}
```

---

## Verification Rules

| Check | Auto-Approve? |
|-------|---------------|
| Issue #1 exists with birth-props label | ✅ Yes |
| Listed in Oracle Family Index (#60) | ✅ Yes |
| Has CLAUDE.md with Oracle identity | ✅ Yes |
| Just a random GitHub repo | ❌ No |

---

## Environment Variables

```bash
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_CALLBACK_URL=https://urchin-app-csg5x.ondigitalocean.app/api/auth/github/callback
```

---

## Key Files

### Backend
- `hooks/github_auth.go` - GitHub OAuth + verification (NEW)
- `migrations/1706745604_add_github.go` - GitHub fields (NEW)
- `main.go` - Bind GitHub routes

### Frontend  
- `web/src/components/GitHubLogin.tsx` - Login button (NEW)
- `web/src/pages/Login.tsx` - Add GitHub option
- `web/src/pages/VerifyRepo.tsx` - Repo verification flow (NEW)

---

## Success Criteria

- [ ] GitHub OAuth login works
- [ ] Claiming a repo with birth issue #1 auto-approves
- [ ] Login page shows "Sign in with GitHub"
- [ ] Oracle name extracted from birth issue
