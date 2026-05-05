import { useState } from 'react'
import { useProfileStore } from '../../store/profileStore'
import { CopyButton } from '../shared/CopyButton'

const TYPE_ICONS = {
  github: '🐙', twitter: '🐦', reddit: '🤖', hackernews: '🔶',
  dns: '🌐', web: '🌐', generic_web_site: '🌐', mastodon: '🐘',
  coinbase: '₿', stellar: '⭐', zcash: 'Ⓩ',
}

function MiniStatus({ status, label }) {
  const cls =
    status === 'scanning' ? 'badge badge-scanning' :
    status === 'found'    ? 'badge badge-found'    :
    status === 'done'     ? 'badge badge-done'     :
    status === 'error'    ? 'badge badge-error'    :
    'badge badge-idle'
  return <span className={cls}>{label || status}</span>
}

function GitHubPane({ data, username }) {
  const { status, profile: gh, repos, emails_found, rate_limited } = data
  if (!username && status === 'idle')
    return <div className="social-pane-empty">No username provided</div>
  if (status === 'idle')
    return <div className="social-pane-empty">Ready</div>
  if (status === 'scanning' && !gh)
    return <div className="social-pane-empty">Fetching…</div>
  if (status === 'error')
    return <div className="social-pane-empty" style={{ color: 'var(--accent-red)' }}>Not found / API error</div>
  if (!gh)
    return <div className="social-pane-empty">No data</div>
  return (
    <div>
      <div className="social-gh-header">
        {gh.avatar_url && <img src={gh.avatar_url} alt="avatar" className="social-gh-avatar" />}
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{gh.name || gh.login}</div>
          <a href={gh.html_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>@{gh.login}</a>
          {gh.location && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>📍 {gh.location}</div>}
          {gh.company  && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>🏢 {gh.company}</div>}
        </div>
      </div>
      {gh.bio && <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '5px 0', lineHeight: 1.4 }}>{gh.bio}</div>}
      <div className="social-gh-stats">
        <span><strong>{gh.public_repos}</strong> repos</span>
        <span><strong>{gh.followers}</strong> followers</span>
        <span>joined <strong>{gh.created_at?.slice(0,4) || '?'}</strong></span>
      </div>
      {emails_found.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Commit emails</div>
          {emails_found.map((e) => (
            <span key={e} className="email-tag" style={{ display: 'inline-flex', marginBottom: 2 }}>
              {e} <CopyButton text={e} />
            </span>
          ))}
        </div>
      )}
      {rate_limited && (
        <div className="warn-banner" style={{ marginTop: 6, fontSize: 10 }}>⚠ Rate limited — add a GitHub token for deeper mining</div>
      )}
      {repos.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
            Recent repos
          </div>
          {repos.slice(0, 5).map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</a>
              {r.language && <span style={{ color: 'var(--text-muted)' }}>{r.language}</span>}
              {r.stars > 0  && <span style={{ color: 'var(--accent-orange)' }}>★{r.stars}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RedditPane({ data, username }) {
  const { status, data: rd } = data
  if (!username && status === 'idle')
    return <div className="social-pane-empty">No username provided</div>
  if (status === 'idle')
    return <div className="social-pane-empty">Ready</div>
  if (status === 'scanning')
    return <div className="social-pane-empty">Querying Reddit…</div>
  if (status === 'error')
    return <div className="social-pane-empty" style={{ color: 'var(--accent-red)' }}>Lookup failed</div>
  if (!rd) return null
  return (
    <div>
      {rd.api_blocked ? (
        <>
          <div className="warn-banner" style={{ fontSize: 10, marginBottom: 6 }}>
            Reddit API requires OAuth. Use links below to investigate manually.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {rd.links?.slice(0, 4).map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: 10, padding: '3px 0', borderBottom: '1px solid var(--border)', display: 'block' }}>
                {l.label} ↗
              </a>
            ))}
          </div>
        </>
      ) : (
        <>
          {rd.profile && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                {rd.profile.account_age_days != null && (
                  <span><strong>{Math.floor(rd.profile.account_age_days / 365)}</strong>y old</span>
                )}
                {rd.profile.total_karma != null && (
                  <span><strong>{rd.profile.total_karma.toLocaleString()}</strong> karma</span>
                )}
              </div>
              <a href={rd.profile.profile_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, marginTop: 3, display: 'block' }}>
                {rd.profile.profile_url} ↗
              </a>
            </div>
          )}
          {rd.top_subreddits?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Subreddits</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {rd.top_subreddits.slice(0, 6).map((s) => (
                  <a key={s.subreddit} href={`https://reddit.com/r/${s.subreddit}`} target="_blank" rel="noopener noreferrer">
                    <span className="chip" style={{ cursor: 'pointer' }}>r/{s.subreddit}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KeybasePane({ data, username }) {
  const { status, data: kb } = data
  if (!username && status === 'idle')
    return <div className="social-pane-empty">No username provided</div>
  if (status === 'idle')
    return <div className="social-pane-empty">Ready</div>
  if (status === 'scanning')
    return <div className="social-pane-empty">Querying Keybase…</div>
  if (status === 'error')
    return <div className="social-pane-empty" style={{ color: 'var(--accent-red)' }}>Lookup failed</div>
  if (!kb?.ok || kb?.not_found)
    return <div className="social-pane-empty">No Keybase profile for this username</div>
  return (
    <div>
      {(kb.full_name || kb.bio) && (
        <div style={{ marginBottom: 6, fontSize: 11 }}>
          {kb.full_name && <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{kb.full_name}</div>}
          {kb.bio && <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1 }}>{kb.bio}</div>}
          {kb.location && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>📍 {kb.location}</div>}
        </div>
      )}
      {kb.linked_accounts?.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
            Linked ({kb.linked_accounts.length})
          </div>
          {kb.linked_accounts.map((a, i) => (
            <div key={i} className="linked-account" style={{ padding: '3px 0', fontSize: 10 }}>
              <span>{TYPE_ICONS[a.type] || '🔗'}</span>
              <span className="platform" style={{ minWidth: 60, fontSize: 9 }}>{a.label}</span>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="handle">{a.username}</a>
              {a.verified && <span className="verified-dot">✓</span>}
            </div>
          ))}
        </div>
      )}
      {kb.crypto_addresses && Object.keys(kb.crypto_addresses).length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Crypto</div>
          {Object.entries(kb.crypto_addresses).map(([coin, addrs]) =>
            addrs.map((addr, i) => (
              <div key={`${coin}-${i}`} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', wordBreak: 'break-all', padding: '2px 0' }}>
                <span style={{ color: 'var(--accent-orange)' }}>{coin.toUpperCase()}: </span>{addr}
              </div>
            ))
          )}
        </div>
      )}
      {kb.profile_url && (
        <a href={kb.profile_url} target="_blank" rel="noopener noreferrer"
           style={{ fontSize: 10, display: 'inline-block', marginTop: 4, color: 'var(--accent-cyan)' }}>
          View on Keybase ↗
        </a>
      )}
    </div>
  )
}

export function SocialIntelCard() {
  const [open, setOpen] = useState(true)
  const { results, profile } = useProfileStore()
  const username = profile.usernames[0] || null

  const gh  = results.github
  const rd  = results.reddit
  const kb  = results.keybase

  const ghLabel = gh.status === 'scanning' ? 'GH…'
    : gh.status === 'done' && gh.profile ? `GH ${gh.repos.length}r`
    : gh.status === 'error' ? 'GH ✗' : 'GH'

  const rdLabel = rd.status === 'scanning' ? 'RD…'
    : rd.status === 'done' ? 'RD ✓'
    : rd.status === 'error' ? 'RD ✗' : 'RD'

  const kbLabel = kb.status === 'scanning' ? 'KB…'
    : kb.status === 'done' && kb.data?.linked_accounts?.length
      ? `KB ${kb.data.linked_accounts.length}`
    : kb.status === 'error' ? 'KB ✗' : 'KB'

  return (
    <div className="scan-card social-intel-card" style={{ marginBottom: 12 }}>
      <div className="scan-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="scan-card-title">
          <span className="scan-card-icon">⚡</span>
          SOCIAL INTEL
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <MiniStatus status={gh.status === 'done' && gh.profile ? 'found' : gh.status} label={ghLabel} />
          <MiniStatus status={rd.status === 'done' ? 'done' : rd.status} label={rdLabel} />
          <MiniStatus status={kb.status === 'done' && kb.data?.linked_accounts?.length ? 'found' : kb.status} label={kbLabel} />
          <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="social-intel-body">
          <div className="social-pane">
            <div className="social-pane-title">🐙 GitHub</div>
            <GitHubPane data={gh} username={username} />
          </div>
          <div className="social-pane-divider" />
          <div className="social-pane">
            <div className="social-pane-title">🤖 Reddit</div>
            <RedditPane data={rd} username={username} />
          </div>
          <div className="social-pane-divider" />
          <div className="social-pane">
            <div className="social-pane-title">🔑 Keybase</div>
            <KeybasePane data={kb} username={username} />
          </div>
        </div>
      )}
    </div>
  )
}
