import { useState } from 'react'
import { useProfileStore } from '../../store/profileStore'
import { api } from '../../utils/api'
import { ScanCard } from '../shared/ScanCard'
import { WhoisCard } from './WhoisCard'
import { DnsCard } from './DnsCard'
import { GeoIpCard } from './GeoIpCard'
import { SubdomainsCard } from './SubdomainsCard'
import { ShodanCard } from './ShodanCard'
import { VirusTotalCard } from './VirusTotalCard'
import { TechStackCard } from './TechStackCard'
import { WaybackCard } from './WaybackCard'

export function NetworksTab() {
  const { setResult, apiKeys } = useProfileStore()
  const [target, setTarget]   = useState('')
  const [scanning, setScanning] = useState(false)

  const runScan = async () => {
    const t = target.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!t) return
    setScanning(true)

    // Reset network results
    setResult('networks', {
      status: 'scanning',
      whois: null, dns: null, geoip: null, subdomains: null,
      shodan: null, virustotal: null, hosting: null, tech_stack: null, wayback: null,
    })

    try {
      const data = await api.networks.scan(t, {
        shodan_key:     apiKeys.shodan     || undefined,
        virustotal_key: apiKeys.virustotal || undefined,
        ipinfo_token:   apiKeys.ipinfo     || undefined,
      })

      setResult('networks', {
        status: 'done',
        whois:      data.whois,
        dns:        data.dns,
        geoip:      data.geoip,
        subdomains: data.subdomains,
        shodan:     data.shodan,
        virustotal: data.virustotal,
        hosting:    data.hosting,
        tech_stack: data.tech_stack,
        wayback:    data.wayback,
        target:     data.target,
        target_type: data.target_type,
      })
    } catch (err) {
      setResult('networks', { status: 'error' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <div className="network-input-row">
        <input
          className="field-input"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="IP address or domain (e.g. example.com)"
          onKeyDown={(e) => e.key === 'Enter' && runScan()}
        />
        <button className="btn btn-primary" style={{ width: 'auto', minWidth: 100 }} onClick={runScan} disabled={scanning || !target.trim()}>
          {scanning ? <><span className="spinner" /> SCANNING</> : '▶ SCAN'}
        </button>
      </div>

      <div className="scan-grid">
        <GeoIpCard />
        <WhoisCard />
        <HostingCard />
        <DnsCard />
        <TechStackCard />
        <WaybackCard />
        <SubdomainsCard />
        <ShodanCard />
        <VirusTotalCard />
      </div>
    </div>
  )
}

// Inline hosting card — simple enough not to need its own file
function HostingCard() {
  const { results } = useProfileStore()
  const { status, hosting } = results.networks

  return (
    <ScanCard icon="🏢" title="HOSTING / ASN" status={hosting?.ok ? 'found' : status === 'scanning' ? 'scanning' : 'idle'}>
      {!hosting ? (
        <div className="empty-state">{status === 'scanning' ? 'Fetching…' : 'Run a scan to see results'}</div>
      ) : !hosting.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{hosting.error}</div>
      ) : (
        <table className="data-table">
          <tbody>
            {hosting.ip     && <tr><td>IP</td><td>{hosting.ip}</td></tr>}
            {hosting.org    && <tr><td>Organization</td><td>{hosting.org}</td></tr>}
            {hosting.asn    && <tr><td>ASN</td><td>{hosting.asn}</td></tr>}
            {hosting.hostname && <tr><td>Hostname</td><td>{hosting.hostname}</td></tr>}
            {hosting.city   && <tr><td>City</td><td>{hosting.city}, {hosting.region}</td></tr>}
            {hosting.country && <tr><td>Country</td><td>{hosting.country}</td></tr>}
            <tr><td>Hosting</td><td style={{ color: hosting.hosting ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{hosting.hosting ? 'Yes (datacenter)' : 'No (residential/business)'}</td></tr>
          </tbody>
        </table>
      )}
    </ScanCard>
  )
}
