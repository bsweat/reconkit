import { useProfileStore } from '../../store/profileStore'

export function ProfileCard() {
  const { profile, results, discovered } = useProfileStore()
  const gh      = results.github
  const email   = results.email
  const keybase = results.keybase
  const sweep   = results.username_sweep

  const facts = []

  if (profile.full_name) facts.push({ label: 'NAME', value: profile.full_name })
  if (profile.location)  facts.push({ label: 'LOCATION', value: profile.location })
  if (profile.employer)  facts.push({ label: 'EMPLOYER', value: profile.employer })

  // From GitHub
  if (gh.profile) {
    if (gh.profile.name && !facts.find(f => f.label === 'NAME')) {
      facts.push({ label: 'NAME', value: gh.profile.name })
    }
    if (gh.profile.location) facts.push({ label: 'GH LOCATION', value: gh.profile.location })
    if (gh.profile.company)  facts.push({ label: 'GH COMPANY',  value: gh.profile.company })
    if (gh.profile.twitter)  facts.push({ label: 'TWITTER',     value: `@${gh.profile.twitter}` })
    if (gh.repos.length)     facts.push({ label: 'GH REPOS',    value: `${gh.repos.length} repos` })
  }

  // Sweep results
  if (sweep.found.length) {
    facts.push({ label: 'ACCOUNTS FOUND', value: `${sweep.found.length} platforms` })
  }

  // Discovered emails
  if (discovered.emails.length) {
    facts.push({ label: 'DISCOVERED EMAILS', value: discovered.emails.join(', ') })
  }

  // Breach info
  if (email.breaches?.breach_count > 0) {
    facts.push({ label: 'BREACHES', value: `${email.breaches.breach_count} found`, alert: true })
  }

  // Gravatar
  if (email.gravatar?.found) {
    facts.push({ label: 'GRAVATAR', value: email.gravatar.display_name || 'Profile found' })
  }

  // Keybase links
  if (keybase.data?.linked_accounts?.length) {
    facts.push({ label: 'KEYBASE LINKS', value: `${keybase.data.linked_accounts.length} accounts` })
  }

  const isEmpty = facts.length === 0

  return (
    <div className="profile-card">
      <div className="profile-card-title">▸ DISCOVERED PROFILE</div>
      {isEmpty ? (
        <div className="profile-empty">Run recon to build a profile…</div>
      ) : (
        <div className="profile-facts">
          {facts.map((f, i) => (
            <div key={i} className="profile-fact" style={f.alert ? { borderColor: 'var(--accent-red)' } : {}}>
              <span className="profile-fact-label">{f.label}</span>
              <span className="profile-fact-value" style={f.alert ? { color: 'var(--accent-red)' } : {}}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
