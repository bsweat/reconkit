import { useState } from 'react'
import { useProfileStore } from '../../store/profileStore'
import { useRecon } from '../../hooks/useRecon'

const API_KEY_FIELDS = [
  { key: 'shodan',       label: 'Shodan',       placeholder: 'Shodan API key', link: 'https://account.shodan.io/' },
  { key: 'virustotal',   label: 'VirusTotal',   placeholder: 'VT API key',     link: 'https://www.virustotal.com/gui/join-us' },
  { key: 'ipinfo',       label: 'IPInfo',       placeholder: 'IPInfo token',   link: 'https://ipinfo.io/signup' },
  { key: 'hibp',         label: 'HIBP',         placeholder: 'HIBP API key',   link: 'https://haveibeenpwned.com/API/Key' },
  { key: 'hunter',       label: 'Hunter.io',    placeholder: 'Hunter API key', link: 'https://hunter.io/api-keys' },
  { key: 'github_token', label: 'GitHub Token', placeholder: 'ghp_...',        link: 'https://github.com/settings/tokens' },
  { key: 'google_cse_id',  label: 'Google CSE ID',  placeholder: 'CSE ID',   link: 'https://programmablesearchengine.google.com/' },
  { key: 'google_cse_key', label: 'Google CSE Key', placeholder: 'API key',  link: 'https://programmablesearchengine.google.com/' },
]

function TagInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) {
      onChange([...value, v])
    }
    setInput('')
  }

  const remove = (item) => onChange(value.filter((v) => v !== item))

  return (
    <div>
      {value.length > 0 && (
        <div className="tag-row">
          {value.map((v) => (
            <span key={v} className="tag">
              {v}
              <button className="tag-remove" onClick={() => remove(v)}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="field-input"
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
      />
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="toggle-track">
          <div className="toggle-thumb" />
        </div>
      </label>
    </div>
  )
}

function Collapse({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button className="collapse-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={`collapse-arrow ${open ? 'open' : ''}`}>▶</span>
        {label}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  )
}

export function ProfilePanel() {
  const { profile, setProfile, apiKeys, setApiKey, scanStatus, resetScan } = useProfileStore()
  const { runRecon, stopRecon } = useRecon()

  const isRunning = scanStatus === 'running'

  const field = (key, label, placeholder, type = 'text') => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type={type}
        value={profile[key] || ''}
        placeholder={placeholder}
        onChange={(e) => setProfile({ [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="profile-panel">
      {/* Logo */}
      <div className="panel-logo">
        <h1>RECONKIT</h1>
        <p>OSINT // CTF TOOL</p>
      </div>

      {/* Core profile fields */}
      <div className="panel-section">
        <div className="panel-section-title">Target Profile</div>

        {field('full_name', 'Full Name', 'Jane Doe')}

        <div className="field-group">
          <label className="field-label">Usernames</label>
          <TagInput
            value={profile.usernames}
            onChange={(v) => setProfile({ usernames: v })}
            placeholder="username (press Enter)"
          />
        </div>

        {field('email', 'Email', 'jane@example.com', 'email')}
        {field('location', 'Location', 'Austin, TX')}
        {field('employer', 'Employer', 'Company name')}

        {/* Extended fields */}
        <Collapse label="MORE FIELDS">
          {field('phone', 'Phone', '+1 555-0100')}
          <div className="field-group">
            <label className="field-label">Aliases</label>
            <TagInput
              value={profile.aliases}
              onChange={(v) => setProfile({ aliases: v })}
              placeholder="alias (press Enter)"
            />
          </div>
          {field('age', 'Age / DOB', '32 or 1992-04-15')}
          {field('education', 'Education', 'University name')}
        </Collapse>

        <div style={{ marginTop: 8 }}>
          <Toggle
            label="CTF Mode"
            checked={profile.is_ctf}
            onChange={(v) => setProfile({ is_ctf: v })}
          />
        </div>
      </div>

      {/* API Keys */}
      <div className="panel-section">
        <Collapse label="API KEYS">
          <div style={{ marginTop: 6 }}>
            {API_KEY_FIELDS.map(({ key, label, placeholder, link }) => (
              <div key={key} className="field-group">
                <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{label}</span>
                  <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: 'var(--text-dim)' }}>get key ↗</a>
                </label>
                <input
                  className="field-input"
                  type="password"
                  value={apiKeys[key] || ''}
                  placeholder={placeholder}
                  onChange={(e) => setApiKey(key, e.target.value)}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </Collapse>
      </div>

      {/* Run / Stop */}
      <div className="panel-section" style={{ marginTop: 'auto' }}>
        {isRunning ? (
          <button className="btn btn-danger" onClick={stopRecon}>
            ■ STOP
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={runRecon}
            disabled={!profile.usernames.length && !profile.email && !profile.full_name}
          >
            ▶ RUN RECON
          </button>
        )}
        {(scanStatus === 'complete' || scanStatus === 'error') && (
          <button className="btn btn-ghost" style={{ marginTop: 6, width: '100%' }} onClick={resetScan}>
            ↺ CLEAR
          </button>
        )}
      </div>
    </div>
  )
}
