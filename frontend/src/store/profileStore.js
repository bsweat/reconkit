import { create } from 'zustand'

const KEYS_LS_KEY = 'reconkit_keys'
const PROFILE_LS_KEY = 'reconkit_profile'

function loadFromLS(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

function saveToLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const defaultProfile = {
  full_name: '',
  usernames: [],
  email: '',
  employer: '',
  location: '',
  phone: '',
  aliases: [],
  age: '',
  education: '',
  is_ctf: false,
}

const defaultApiKeys = {
  shodan: '',
  virustotal: '',
  ipinfo: '',
  hibp: '',
  hunter: '',
  github_token: '',
  google_cse_id: '',
  google_cse_key: '',
}

const defaultResults = {
  username_sweep: { status: 'idle', found: [], checked: 0, total: 0 },
  github: { status: 'idle', profile: null, repos: [], emails_found: [], rate_limited: false },
  email: { status: 'idle', breaches: null, pastes: null, gravatar: null, hunter: null, disposable: false },
  reddit: { status: 'idle', data: null },
  keybase: { status: 'idle', data: null },
  pastes: { status: 'idle', data: null },
  dorks: { status: 'idle', sections: [] },
  networks: {
    status: 'idle',
    whois: null, dns: null, geoip: null, subdomains: null,
    shodan: null, virustotal: null, hosting: null, tech_stack: null, wayback: null,
  },
}

const defaultDiscovered = {
  emails: [],
  usernames: [],
  social_links: [],
}

export const useProfileStore = create((set, get) => ({
  // ── Profile ────────────────────────────────────────────────
  profile: loadFromLS(PROFILE_LS_KEY, defaultProfile),
  setProfile: (updates) =>
    set((s) => {
      const updated = { ...s.profile, ...updates }
      saveToLS(PROFILE_LS_KEY, updated)
      return { profile: updated }
    }),
  resetProfile: () => {
    saveToLS(PROFILE_LS_KEY, defaultProfile)
    set({ profile: defaultProfile })
  },

  // ── API Keys ────────────────────────────────────────────────
  apiKeys: loadFromLS(KEYS_LS_KEY, defaultApiKeys),
  setApiKey: (key, value) =>
    set((s) => {
      const updated = { ...s.apiKeys, [key]: value }
      saveToLS(KEYS_LS_KEY, updated)
      return { apiKeys: updated }
    }),

  // ── Scan State ─────────────────────────────────────────────
  scanStatus: 'idle',   // 'idle' | 'running' | 'complete' | 'error'
  activeTab: 'people',
  setScanStatus: (v) => set({ scanStatus: v }),
  setActiveTab: (v) => set({ activeTab: v }),

  // ── Results ────────────────────────────────────────────────
  results: defaultResults,

  setResult: (module, updates) =>
    set((s) => ({
      results: {
        ...s.results,
        [module]: { ...s.results[module], ...updates },
      },
    })),

  appendSweepResult: (result) =>
    set((s) => {
      const sweep = s.results.username_sweep
      const found = result.found
        ? [...sweep.found, { site: result.site, url: result.url, category: result.category }]
        : sweep.found
      return {
        results: {
          ...s.results,
          username_sweep: {
            ...sweep,
            status: 'scanning',
            found,
            checked: result.checked || sweep.checked + 1,
            total: result.total || sweep.total,
          },
        },
      }
    }),

  appendGitHubRepo: (repo) =>
    set((s) => ({
      results: {
        ...s.results,
        github: {
          ...s.results.github,
          repos: [...s.results.github.repos, repo],
        },
      },
    })),

  // ── Discovered Data ─────────────────────────────────────────
  discovered: defaultDiscovered,

  addDiscoveredEmails: (emails) =>
    set((s) => {
      const existing = new Set(s.discovered.emails)
      const profileEmail = s.profile.email
      const newEmails = emails.filter((e) => e && !existing.has(e) && e !== profileEmail)
      if (!newEmails.length) return s
      return {
        discovered: {
          ...s.discovered,
          emails: [...s.discovered.emails, ...newEmails],
        },
      }
    }),

  addDiscoveredUsernames: (usernames) =>
    set((s) => {
      const existing = new Set([
        ...s.discovered.usernames,
        ...s.profile.usernames,
      ])
      const newOnes = usernames.filter((u) => u && !existing.has(u))
      if (!newOnes.length) return s
      return {
        discovered: {
          ...s.discovered,
          usernames: [...s.discovered.usernames, ...newOnes],
        },
      }
    }),

  // ── Reset for new scan ──────────────────────────────────────
  resetScan: () =>
    set({
      results: defaultResults,
      discovered: defaultDiscovered,
      scanStatus: 'idle',
    }),
}))
