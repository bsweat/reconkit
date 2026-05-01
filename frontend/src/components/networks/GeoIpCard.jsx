import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function GeoIpCard() {
  const { results } = useProfileStore()
  const { status, geoip } = results.networks

  return (
    <ScanCard icon="📍" title="GEO IP" status={geoip?.ok ? 'found' : status === 'scanning' ? 'scanning' : 'idle'}>
      {!geoip ? (
        <div className="empty-state">{status === 'scanning' ? 'Resolving…' : 'Run a scan'}</div>
      ) : !geoip.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{geoip.error || geoip.message}</div>
      ) : (
        <table className="data-table">
          <tbody>
            {geoip.query         && <tr><td>IP</td><td>{geoip.query}</td></tr>}
            {geoip.isp           && <tr><td>ISP</td><td>{geoip.isp}</td></tr>}
            {geoip.org           && <tr><td>Org</td><td>{geoip.org}</td></tr>}
            {geoip.as            && <tr><td>AS</td><td>{geoip.as}</td></tr>}
            {geoip.city          && <tr><td>City</td><td>{geoip.city}</td></tr>}
            {geoip.regionName    && <tr><td>Region</td><td>{geoip.regionName}</td></tr>}
            {geoip.country       && <tr><td>Country</td><td>{geoip.countryCode} — {geoip.country}</td></tr>}
            {geoip.timezone      && <tr><td>Timezone</td><td>{geoip.timezone}</td></tr>}
            {geoip.lat           && <tr><td>Coordinates</td><td>{geoip.lat}, {geoip.lon}</td></tr>}
            {geoip.reverse       && <tr><td>Reverse DNS</td><td>{geoip.reverse}</td></tr>}
          </tbody>
        </table>
      )}
    </ScanCard>
  )
}
