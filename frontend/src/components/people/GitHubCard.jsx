import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'
import { CopyButton } from '../shared/CopyButton'

export function GitHubCard() {
  const { results, profile } = useProfileStore()
  const { status, profile: gh, repos, emails_found, rate_limited } = results.github
  const username = profile.usernames[0] || null

  const statusLabel = status === 'scanning'
    ? 'scanning…'
    : status === 'done' && gh
    ? `${repos.length} repos · ${emails_found.length} emails`
    : null

  return (
    <ScanCard
      icon="🐙"
      title="GITHUB"
      status={gh ? 'found' : status}
      statusLabel={statusLabel}
    >
      {!username && status === 'idle' ? (
        <div className="empty-state">Provide a username to enable</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready</div>
      ) : status === 'scanning' && !gh ? (
        <div className="empty-state">Fetching GitHub profile…</div>
      ) : status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>GitHub user not found or API error</div>
      ) : gh ? (
        <>
          <div className="github-profile">
            {gh.avatar_url && (
              <img src={gh.avatar_url} alt="avatar" className="github-avatar" />
            )}
            <div className="github-meta">
              <h3>{gh.name || gh.login}</h3>
              <div className="handle">
                <a href={gh.html_url} target="_blank" rel="noopener noreferrer">@{gh.login}</a>
              </div>
              {gh.bio && <div className="bio">{gh.bio}</div>}
              {gh.location && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📍 {gh.location}</div>}
              {gh.company && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏢 {gh.company}</div>}
              {gh.twitter && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  🐦 <a href={`https://twitter.com/${gh.twitter}`} target="_blank" rel="noopener noreferrer">@{gh.twitter}</a>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="github-stats">
            <div className="github-stat">
              <div className="num">{gh.public_repos}</div>
              <div className="lbl">repos</div>
            </div>
            <div className="github-stat">
              <div className="num">{gh.followers}</div>
              <div className="lbl">followers</div>
            </div>
            <div className="github-stat">
              <div className="num">{gh.public_gists}</div>
              <div className="lbl">gists</div>
            </div>
            <div className="github-stat">
              <div className="num">{gh.created_at?.slice(0, 4) || '?'}</div>
              <div className="lbl">joined</div>
            </div>
          </div>

          {/* Discovered emails */}
          {emails_found.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
                Emails from commit history
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {emails_found.map((e) => (
                  <span key={e} className="email-tag">
                    {e}
                    <CopyButton text={e} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {rate_limited && (
            <div className="warn-banner">
              ⚠ GitHub rate limit reached. Add a GitHub token in API Keys for deeper scanning.
            </div>
          )}

          {/* Recent repos */}
          {repos.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
                Repositories
              </div>
              {repos.slice(0, 8).map((r) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </a>
                  {r.language && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{r.language}</span>}
                  {r.stars > 0 && <span style={{ color: 'var(--accent-orange)', fontSize: 10 }}>★{r.stars}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </ScanCard>
  )
}
