import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'
import { CopyButton } from '../shared/CopyButton'

export function WhoisCard() {
  const { results } = useProfileStore()
  const { status, whois } = results.networks

  const cardStatus = whois?.ok ? 'found' : status === 'scanning' ? 'scanning' : 'idle'

  return (
    <ScanCard icon="📄" title="WHOIS" status={cardStatus}>
      {!whois ? (
        <div className="empty-state">{status === 'scanning' ? 'Fetching WHOIS…' : 'Run a scan'}</div>
      ) : !whois.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{whois.error}</div>
      ) : (
        <table className="data-table">
          <tbody>
            {whois.registrar     && <tr><td>Registrar</td><td>{Array.isArray(whois.registrar) ? whois.registrar[0] : whois.registrar}</td></tr>}
            {whois.org           && <tr><td>Organization</td><td>{Array.isArray(whois.org) ? whois.org[0] : whois.org}</td></tr>}
            {whois.country       && <tr><td>Country</td><td>{whois.country}</td></tr>}
            {whois.creation_date && <tr><td>Created</td><td>{String(whois.creation_date).slice(0,10)}</td></tr>}
            {whois.expiration_date && <tr><td>Expires</td><td>{String(whois.expiration_date).slice(0,10)}</td></tr>}
            {whois.emails        && <tr><td>Emails</td><td>{Array.isArray(whois.emails) ? whois.emails.join(', ') : whois.emails}</td></tr>}
            {whois.name_servers  && <tr><td>Name Servers</td><td>{(Array.isArray(whois.name_servers) ? whois.name_servers : [whois.name_servers]).slice(0,3).join(', ')}</td></tr>}
            {whois.dnssec        && <tr><td>DNSSEC</td><td>{whois.dnssec}</td></tr>}
          </tbody>
        </table>
      )}
    </ScanCard>
  )
}
