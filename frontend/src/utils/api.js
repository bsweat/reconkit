/**
 * API utility — fetch wrappers for all ReconKit endpoints.
 * All POST requests send JSON body.
 * SSE endpoints return the raw fetch Response for streaming.
 */

const BASE = ''  // relative — Vite proxy handles /api in dev

async function post(path, body) {
  const resp = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`${resp.status}: ${text}`)
  }
  return resp.json()
}

async function postStream(path, body) {
  // Returns the raw Response for SSE streaming via getReader()
  const resp = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp
}

// ── People ─────────────────────────────────────────────────────
export const api = {
  people: {
    username: (username)                    => postStream('/api/people/username', { username }),
    github:   (username, github_token)      => postStream('/api/people/github', { username, github_token }),
    email:    (email, hibp_key, hunter_key) => post('/api/people/email', { email, hibp_key, hunter_key }),
    reddit:   (username)                    => post('/api/people/reddit', { username }),
    keybase:  (username)                    => post('/api/people/keybase', { username }),
    pastes:   (query, cse_key, cse_id)     => post('/api/people/pastes', { query, google_cse_key: cse_key, google_cse_id: cse_id }),
    dorks:    (payload)                     => post('/api/people/dorks', payload),
  },
  networks: {
    scan:       (target, keys = {})   => post('/api/networks/scan', { target, ...keys }),
    whois:      (target)              => post('/api/networks/whois', { target }),
    dns:        (target)              => post('/api/networks/dns', { target }),
    geoip:      (target)              => post('/api/networks/geoip', { target }),
    subdomains: (target)              => post('/api/networks/subdomains', { target }),
    shodan:     (target)              => post('/api/networks/shodan', { target }),
    virustotal: (target)              => post('/api/networks/virustotal', { target }),
    hosting:    (target)              => post('/api/networks/hosting', { target }),
    techstack:  (target)              => post('/api/networks/techstack', { target }),
    wayback:    (target)              => post('/api/networks/wayback', { target }),
  },
}

/**
 * Parse a fetch Response body as an SSE stream.
 * Calls onEvent(eventName, parsedData) for each event, onDone() when stream ends.
 */
export async function readSSEStream(response, { onEvent, onDone, onError, signal }) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      // Normalize CRLF → LF so the split works regardless of server line endings
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      // SSE messages are separated by double newline
      const messages = buffer.split('\n\n')
      buffer = messages.pop() ?? ''   // last chunk may be incomplete

      for (const msg of messages) {
        if (!msg.trim()) continue
        let eventName = 'message'
        let dataStr   = ''

        for (const line of msg.split('\n')) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim()
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr)
            onEvent(eventName, parsed)
          } catch {
            onEvent(eventName, dataStr)
          }
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err)
    }
  } finally {
    reader.cancel().catch(() => {})
    onDone?.()
  }
}
