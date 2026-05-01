/**
 * useRecon — orchestrates all OSINT scans and progressive profiling.
 *
 * Progressive triggers (via Zustand subscriptions):
 *   - GitHub emails found → auto-run email intel on new addresses
 *   - Keybase GitHub link found → auto-trigger GitHub scan
 *   - Any scan finishes → regenerate dorks
 */
import { useRef, useCallback } from 'react'
import { useProfileStore } from '../store/profileStore'
import { api, readSSEStream } from '../utils/api'

export function useRecon() {
  const store    = useProfileStore()
  const abortRef = useRef(null)

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Rebuild dorks using current profile + discovered data */
  const regenerateDorks = useCallback(async () => {
    const { profile, discovered } = useProfileStore.getState()
    try {
      store.setResult('dorks', { status: 'scanning' })
      const resp = await api.people.dorks({
        full_name:            profile.full_name  || null,
        usernames:            profile.usernames,
        email:                profile.email      || null,
        employer:             profile.employer   || null,
        location:             profile.location   || null,
        phone:                profile.phone      || null,
        aliases:              profile.aliases,
        age:                  profile.age        || null,
        education:            profile.education  || null,
        is_ctf:               profile.is_ctf,
        discovered_emails:    discovered.emails,
        discovered_usernames: discovered.usernames,
      })
      store.setResult('dorks', { status: 'done', sections: resp.sections })
    } catch {
      store.setResult('dorks', { status: 'error', sections: [] })
    }
  }, [store])

  /** Run email intel for one address; abortable */
  const runEmailIntel = useCallback(async (email, signal) => {
    if (signal?.aborted) return
    const { apiKeys } = useProfileStore.getState()
    store.setResult('email', { status: 'scanning' })
    try {
      const data = await api.people.email(email, apiKeys.hibp || null, apiKeys.hunter || null)
      store.setResult('email', { status: 'done', ...data })
      regenerateDorks()
    } catch {
      store.setResult('email', { status: 'error' })
    }
  }, [store, regenerateDorks])

  /** GitHub deep dive — streams profile, repos, commit emails */
  const runGitHub = useCallback(async (username, signal) => {
    const { apiKeys } = useProfileStore.getState()
    store.setResult('github', { status: 'scanning', profile: null, repos: [], emails_found: [], rate_limited: false })
    try {
      const response = await api.people.github(username, apiKeys.github_token || null)
      await readSSEStream(response, {
        signal,
        onEvent(eventName, data) {
          if (eventName === 'profile') {
            store.setResult('github', { profile: data })
            if (data.email) store.addDiscoveredEmails([data.email])
          } else if (eventName === 'repo') {
            store.appendGitHubRepo(data)
          } else if (eventName === 'emails_found') {
            store.setResult('github', { emails_found: data.emails || [] })
            if (data.emails?.length) {
              store.addDiscoveredEmails(data.emails)
              // Progressive: auto-run email intel on first discovered commit email
              const { apiKeys: keys } = useProfileStore.getState()
              if (keys.hibp || keys.hunter) {
                runEmailIntel(data.emails[0], signal)
              }
            }
          } else if (eventName === 'done') {
            store.setResult('github', { status: 'done', rate_limited: data.rate_limited })
            regenerateDorks()
          } else if (eventName === 'error') {
            store.setResult('github', { status: 'error' })
          }
        },
        onError()  { store.setResult('github', { status: 'error' }) },
        onDone() {
          const s = useProfileStore.getState().results.github
          if (s.status === 'scanning') store.setResult('github', { status: 'done' })
        },
      })
    } catch {
      store.setResult('github', { status: 'error' })
    }
  }, [store, runEmailIntel, regenerateDorks])

  /** Username sweep — streams result per site */
  const runUsernameSweep = useCallback(async (username, signal) => {
    store.setResult('username_sweep', { status: 'scanning', found: [], checked: 0, total: 0 })
    try {
      const response = await api.people.username(username)
      await readSSEStream(response, {
        signal,
        onEvent(eventName, data) {
          if (eventName === 'result') {
            store.appendSweepResult(data)
          } else if (eventName === 'done') {
            store.setResult('username_sweep', { status: 'done', checked: data.checked, total: data.checked })
          }
        },
        onError() { store.setResult('username_sweep', { status: 'error' }) },
        onDone() {
          const s = useProfileStore.getState().results.username_sweep
          if (s.status !== 'error' && s.status !== 'done') store.setResult('username_sweep', { status: 'done' })
        },
      })
    } catch {
      store.setResult('username_sweep', { status: 'error' })
    }
  }, [store])

  /** Reddit */
  const runReddit = useCallback(async (username) => {
    store.setResult('reddit', { status: 'scanning', data: null })
    try {
      const data = await api.people.reddit(username)
      store.setResult('reddit', { status: 'done', data })
    } catch {
      store.setResult('reddit', { status: 'error' })
    }
  }, [store])

  /** Keybase — auto-triggers GitHub if linked account found */
  const runKeybase = useCallback(async (username, signal) => {
    store.setResult('keybase', { status: 'scanning', data: null })
    try {
      const data = await api.people.keybase(username)
      store.setResult('keybase', { status: 'done', data })

      // Progressive: GitHub link discovered → fire GitHub scan
      if (data.ok && data.linked_accounts) {
        const ghLink = data.linked_accounts.find((a) => a.type === 'github')
        if (ghLink?.username) {
          const { profile } = useProfileStore.getState()
          store.addDiscoveredUsernames([ghLink.username])
          // Only fire if we haven't already run GitHub for this username
          const ghStatus = useProfileStore.getState().results.github.status
          if (!profile.usernames.includes(ghLink.username) && ghStatus === 'idle') {
            runGitHub(ghLink.username, signal)
          }
        }
      }

      regenerateDorks()
    } catch {
      store.setResult('keybase', { status: 'error' })
    }
  }, [store, runGitHub, regenerateDorks])

  /** Paste search */
  const runPastes = useCallback(async (query) => {
    const { apiKeys } = useProfileStore.getState()
    store.setResult('pastes', { status: 'scanning', data: null })
    try {
      const data = await api.people.pastes(query, apiKeys.google_cse_key || null, apiKeys.google_cse_id || null)
      store.setResult('pastes', { status: 'done', data })
    } catch {
      store.setResult('pastes', { status: 'error' })
    }
  }, [store])

  // ── Main Run ────────────────────────────────────────────────────────────

  const runRecon = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const signal = controller.signal

    store.resetScan()
    store.setScanStatus('running')

    const { profile } = useProfileStore.getState()
    const firstUsername = profile.usernames[0] || null
    const email         = profile.email         || null

    const tasks = []

    if (firstUsername) {
      tasks.push(runUsernameSweep(firstUsername, signal))
      tasks.push(runGitHub(firstUsername, signal))
      tasks.push(runKeybase(firstUsername, signal))
      tasks.push(runReddit(firstUsername))
    }

    if (email) {
      tasks.push(runEmailIntel(email, signal))
    }

    const pasteQuery = firstUsername || email
    if (pasteQuery) {
      tasks.push(runPastes(pasteQuery))
    }

    // Generate initial dorks immediately
    tasks.push(regenerateDorks())

    await Promise.allSettled(tasks)

    if (!signal.aborted) {
      store.setScanStatus('complete')
    }
  }, [store, runUsernameSweep, runGitHub, runKeybase, runReddit, runEmailIntel, runPastes, regenerateDorks])

  const stopRecon = useCallback(() => {
    abortRef.current?.abort()
    store.setScanStatus('idle')
  }, [store])

  return { runRecon, stopRecon }
}
