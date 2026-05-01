import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function PasteCard() {
  const { results, profile } = useProfileStore()
  const { status, data } = results.pastes
  const query = profile.usernames[0] || profile.email || null

  const liveCount = data?.live_count || 0

  return (
    <ScanCard
      icon="📋"
      title="PASTE SITES"
      status={liveCount > 0 ? 'found' : status}
      statusLabel={status === 'done' ? (liveCount > 0 ? `${liveCount} live hits` : 'manual links ready') : null}
    >
      {!query && status === 'idle' ? (
        <div className="empty-state">Provide a username or email to enable</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready</div>
      ) : status === 'scanning' ? (
        <div className="empty-state">Searching paste sites…</div>
      ) : status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>Paste search failed</div>
      ) : data ? (
        <>
          {/* Live results */}
          {data.live_enabled && liveCount > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--accent-green)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {liveCount} Live Result{liveCount !== 1 ? 's' : ''}
              </div>
              {data.live_results.map((r, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                  {r.snippet && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.snippet.slice(0, 100)}</div>}
                </div>
              ))}
            </div>
          )}

          {!data.live_enabled && (
            <div className="info-banner">ℹ Add Google CSE keys for live paste search. Manual dork links below.</div>
          )}

          {/* Manual dork links */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Manual Search Links
            </div>
            {data.manual_links?.map((l, i) => (
              <div key={i} className="paste-link">
                <span className="site">{l.site}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Search →
                </a>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ScanCard>
  )
}
