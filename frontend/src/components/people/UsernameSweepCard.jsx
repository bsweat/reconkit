import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function UsernameSweepCard() {
  const { results, profile } = useProfileStore()
  const { status, found, checked, total } = results.username_sweep
  const username = profile.usernames[0] || null

  const pct = total > 0 ? Math.round((checked / total) * 100) : (checked > 0 ? Math.min(checked, 100) : 0)

  const statusLabel = status === 'scanning'
    ? `${checked} checked`
    : status === 'done'
    ? `${found.length} found / ${checked} checked`
    : null

  return (
    <ScanCard icon="◈" title="USERNAME SWEEP" status={found.length > 0 && status === 'done' ? 'found' : status} statusLabel={statusLabel}>
      {!username && status === 'idle' ? (
        <div className="empty-state">Provide a username to enable sweep</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready to sweep 485+ platforms</div>
      ) : (
        <>
          {/* Progress bar */}
          {(status === 'scanning' || status === 'done') && (
            <div className="sweep-progress">
              <div className="sweep-bar-track">
                <div className="sweep-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="sweep-stats">{checked} / {total || '?'}</span>
            </div>
          )}

          {/* Found accounts */}
          {found.length > 0 && (
            <div className="sweep-found-list">
              {found.map((r) => (
                <div key={r.site} className="sweep-found-item">
                  <span className="found-dot" />
                  <a href={r.url} target="_blank" rel="noopener noreferrer">{r.site}</a>
                  <span className="category">{r.category}</span>
                </div>
              ))}
            </div>
          )}

          {status === 'done' && found.length === 0 && (
            <div className="empty-state">No accounts found across {checked} platforms</div>
          )}
        </>
      )}
    </ScanCard>
  )
}
