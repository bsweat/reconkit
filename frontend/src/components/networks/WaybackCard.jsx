import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function WaybackCard() {
  const { results } = useProfileStore()
  const { status, wayback } = results.networks

  return (
    <ScanCard icon="⏰" title="WAYBACK MACHINE" status={wayback?.available ? 'found' : status === 'scanning' ? 'scanning' : 'idle'}>
      {!wayback ? (
        <div className="empty-state">{status === 'scanning' ? 'Checking Wayback…' : 'Run a scan'}</div>
      ) : !wayback.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{wayback.error}</div>
      ) : !wayback.available ? (
        <div className="empty-state">No Wayback Machine snapshots available for this target</div>
      ) : (
        <>
          <table className="data-table" style={{ marginBottom: 10 }}>
            <tbody>
              <tr><td>Last Snapshot</td><td>{wayback.snapshot_ts?.slice(0,4)}-{wayback.snapshot_ts?.slice(4,6)}-{wayback.snapshot_ts?.slice(6,8)}</td></tr>
              <tr><td>HTTP Status</td><td>{wayback.snapshot_status}</td></tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={wayback.snapshot_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', padding: '3px 10px' }}>
              View Snapshot ↗
            </a>
            <a href={wayback.wayback_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', padding: '3px 10px' }}>
              All Snapshots ↗
            </a>
          </div>
        </>
      )}
    </ScanCard>
  )
}
