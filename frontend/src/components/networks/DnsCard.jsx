import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function DnsCard() {
  const { results } = useProfileStore()
  const { status, dns } = results.networks

  const records = dns?.records || {}
  const hasRecords = Object.values(records).some(v => Array.isArray(v) ? v.length > 0 : v && Object.keys(v).length > 0)

  return (
    <ScanCard icon="🔀" title="DNS RECORDS" status={hasRecords ? 'found' : status === 'scanning' ? 'scanning' : 'idle'}>
      {!dns ? (
        <div className="empty-state">{status === 'scanning' ? 'Querying DNS…' : 'Run a scan'}</div>
      ) : !dns.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{dns.error}</div>
      ) : (
        <div>
          {['A','AAAA','MX','NS','TXT','CNAME','SOA'].map(type => {
            const vals = records[type]
            if (!vals || !vals.length) return null
            return (
              <div key={type} className="dns-record">
                <div className="dns-record-type">{type}</div>
                {vals.map((v, i) => (
                  <div key={i} className="dns-record-value">{v}</div>
                ))}
              </div>
            )
          })}
          {records.PTR && Object.keys(records.PTR).length > 0 && (
            <div className="dns-record">
              <div className="dns-record-type">PTR (reverse DNS)</div>
              {Object.entries(records.PTR).map(([ip, ptr]) => ptr && (
                <div key={ip} className="dns-record-value">{ip} → {ptr}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </ScanCard>
  )
}
