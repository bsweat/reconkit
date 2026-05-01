import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

const TYPE_ICONS = {
  github:     '🐙',
  twitter:    '🐦',
  reddit:     '🤖',
  hackernews: '🔶',
  dns:        '🌐',
  web:        '🌐',
  generic_web_site: '🌐',
  coinbase:   '₿',
  mastodon:   '🐘',
  stellar:    '⭐',
  zcash:      'Ⓩ',
}

export function KeybaseCard() {
  const { results, profile } = useProfileStore()
  const { status, data } = results.keybase
  const username = profile.usernames[0] || null

  const hasData = data?.ok && data.linked_accounts?.length > 0

  return (
    <ScanCard icon="🔑" title="KEYBASE" status={hasData ? 'found' : status}>
      {!username && status === 'idle' ? (
        <div className="empty-state">Provide a username to enable</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready</div>
      ) : status === 'scanning' ? (
        <div className="empty-state">Querying Keybase…</div>
      ) : status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>Keybase lookup failed</div>
      ) : data?.not_found || !data?.ok ? (
        <div className="empty-state">No Keybase profile found for this username</div>
      ) : (
        <>
          {/* Profile summary */}
          {(data.full_name || data.bio || data.location) && (
            <div style={{ marginBottom: 10, padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}>
              {data.full_name && <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{data.full_name}</div>}
              {data.bio && <div style={{ color: 'var(--text-secondary)' }}>{data.bio}</div>}
              {data.location && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>📍 {data.location}</div>}
            </div>
          )}

          {/* Linked accounts */}
          {data.linked_accounts?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Verified Linked Accounts ({data.linked_accounts.length})
              </div>
              {data.linked_accounts.map((a, i) => (
                <div key={i} className="linked-account">
                  <span>{TYPE_ICONS[a.type] || '🔗'}</span>
                  <span className="platform">{a.label}</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="handle">
                    {a.username}
                  </a>
                  {a.verified && <span className="verified-dot">✓</span>}
                </div>
              ))}
            </div>
          )}

          {/* Crypto addresses */}
          {data.crypto_addresses && Object.keys(data.crypto_addresses).length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Crypto Addresses
              </div>
              {Object.entries(data.crypto_addresses).map(([coin, addrs]) => (
                addrs.map((addr, i) => (
                  <div key={`${coin}-${i}`} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 0', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{coin.toUpperCase()}: </span>
                    {addr}
                  </div>
                ))
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <a href={data.profile_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', padding: '3px 10px' }}>
              View on Keybase ↗
            </a>
          </div>
        </>
      )}
    </ScanCard>
  )
}
