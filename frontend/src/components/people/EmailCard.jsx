import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function EmailCard() {
  const { results, profile, apiKeys } = useProfileStore()
  const { status, breaches, pastes, gravatar, hunter, disposable, email: scannedEmail } = results.email
  const email = profile.email

  const breachCount  = breaches?.breach_count || 0
  const pasteCount   = pastes?.paste_count || 0
  const statusLabel  = status === 'done'
    ? `${breachCount} breach${breachCount !== 1 ? 'es' : ''}`
    : null

  return (
    <ScanCard
      icon="✉"
      title="EMAIL INTEL"
      status={status === 'done' && breachCount > 0 ? 'found' : status}
      statusLabel={statusLabel}
      defaultOpen={false}
      autoOpen
    >
      {!email && status === 'idle' ? (
        <div className="empty-state">Provide an email to enable</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready</div>
      ) : status === 'scanning' ? (
        <div className="empty-state">Checking email intelligence…</div>
      ) : status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>Email intel failed</div>
      ) : (
        <>
          {/* Disposable check */}
          {disposable && (
            <div className="warn-banner">⚠ Disposable / temporary email provider detected</div>
          )}

          {/* Gravatar */}
          {gravatar?.ok && gravatar.found && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4 }}>
              <img src={gravatar.avatar_url} alt="gravatar" style={{ width: 40, height: 40, borderRadius: 4 }} />
              <div>
                {gravatar.display_name && <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{gravatar.display_name}</div>}
                {gravatar.location && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {gravatar.location}</div>}
                {gravatar.about && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{gravatar.about?.slice(0, 120)}</div>}
                {gravatar.linked_accounts?.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Linked: {gravatar.linked_accounts.map(a => a.shortname).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
          {gravatar?.ok && !gravatar.found && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>No Gravatar profile found</div>
          )}

          {/* Hunter */}
          {hunter?.ok && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Hunter.io Verification
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                <span className={`chip ${hunter.status === 'valid' ? '' : ''}`} style={hunter.status === 'valid' ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)' } : {}}>
                  {hunter.status?.toUpperCase()}
                </span>
                {hunter.score != null && <span className="chip">score: {hunter.score}</span>}
                {hunter.webmail && <span className="chip">webmail</span>}
                {hunter.disposable && <span className="chip" style={{ color: 'var(--accent-red)' }}>disposable</span>}
              </div>
              {hunter.sources?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Found on:</div>
                  {hunter.sources.slice(0, 3).map((s, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <a href={s.uri} target="_blank" rel="noopener noreferrer">{s.domain}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HIBP Breaches */}
          {!apiKeys.hibp ? (
            <div className="info-banner">ℹ Add a HIBP API key to check data breaches</div>
          ) : breaches?.ok === false ? (
            <div className="warn-banner">⚠ {breaches.error}</div>
          ) : breachCount > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: 'var(--accent-red)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                ⚠ {breachCount} Data Breach{breachCount !== 1 ? 'es' : ''} Found
              </div>
              {breaches.breaches?.slice(0, 6).map((b) => (
                <div key={b.name} className="breach-item">
                  <div style={{ flex: 1 }}>
                    <div className="name">{b.title}</div>
                    <div className="date">{b.breach_date} · {b.pwn_count?.toLocaleString()} accounts</div>
                    {b.data_classes?.length > 0 && (
                      <div className="data-classes">
                        {b.data_classes.slice(0, 5).map((d) => (
                          <span key={d} className="chip">{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {breachCount > 6 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>…and {breachCount - 6} more</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>✓ No breaches found</div>
          )}

          {/* HIBP Pastes */}
          {pasteCount > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--accent-orange)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                ⚠ Found in {pasteCount} Paste{pasteCount !== 1 ? 's' : ''}
              </div>
              {pastes.pastes?.slice(0, 3).map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>
                  {p.source} — {p.date?.slice(0, 10)} {p.title ? `"${p.title}"` : ''}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ScanCard>
  )
}
