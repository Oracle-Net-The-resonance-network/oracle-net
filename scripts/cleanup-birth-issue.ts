/**
 * Cleanup script: Convert birth_issue from number to URL
 *
 * Usage: bun scripts/cleanup-birth-issue.ts
 */

const API_URL = process.env.POCKETBASE_URL || 'https://urchin-app-csg5x.ondigitalocean.app'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const DEFAULT_BIRTH_REPO = 'Soul-Brews-Studio/oracle-v2'

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD')
    process.exit(1)
  }

  // 1. Auth as admin
  console.log('Authenticating as admin...')
  const authRes = await fetch(`${API_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  })

  if (!authRes.ok) {
    console.error('Auth failed:', await authRes.text())
    process.exit(1)
  }

  const { token } = await authRes.json()
  console.log('✓ Authenticated')

  // 2. Fetch all oracles
  console.log('Fetching oracles...')
  const oraclesRes = await fetch(`${API_URL}/api/collections/oracles/records?perPage=500`, {
    headers: { Authorization: token }
  })

  const { items: oracles } = await oraclesRes.json()
  console.log(`Found ${oracles.length} oracles`)

  // 3. Find oracles with number-only birth_issue
  let updated = 0
  for (const oracle of oracles) {
    const birthIssue = oracle.birth_issue

    // Skip if empty or already a URL
    if (!birthIssue) continue
    if (String(birthIssue).startsWith('http')) continue

    // It's a number - convert to URL
    const newUrl = `https://github.com/${DEFAULT_BIRTH_REPO}/issues/${birthIssue}`
    console.log(`Updating ${oracle.name}: ${birthIssue} → ${newUrl}`)

    const updateRes = await fetch(`${API_URL}/api/collections/oracles/records/${oracle.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      },
      body: JSON.stringify({ birth_issue: newUrl })
    })

    if (updateRes.ok) {
      updated++
      console.log(`  ✓ Updated`)
    } else {
      console.log(`  ✗ Failed:`, await updateRes.text())
    }
  }

  console.log(`\nDone! Updated ${updated} oracles`)
}

main().catch(console.error)
