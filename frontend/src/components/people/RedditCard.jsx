import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function RedditCard() {
  const { results, profile } = useProfileStore()
  const { status, data } = results.reddit
  const username = profile.usernames[0] || null

  return (
    <ScanCard icon="🤖" title="REDDIT" status={data?.api_blocked ? 'blocked' : status}>
      {!username && status === 'idle' ? (
        <div className="empty-state">Provide a username to enable</div>
      ) : status === 'idle' ? (
        <div className="empty-state">Ready</div>
      ) : status === 'scanning' ? (
        <div className="empty-state">Querying Reddit…</div>
      ) : status === 'error' ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>Reddit lookup failed</div>
      ) : data ? (
        <>
          {data.api_blocked ? (
            <>
              <div className="warn-banner">
                ⚠ Reddit API requires OAuth for server-side access. Use these links to investigate manually.
              </div>
              <ul className="data-list">
                {data.links?.map((l, i) => (
                  <li key={i}>
                    <span className="found-dot" />
                    <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {/* Profile */}
              <div style={{ marginBottom: 10 }}>
                <table className="data-table">
                  <tbody>
                    {data.profile?.account_age_days != null && (
                      <tr><td>Account Age</td><td>{Math.floor(data.profile.account_age_days / 365)}y {Math.floor((data.profile.account_age_days % 365) / 30)}m</td></tr>
                    )}
                    {data.profile?.total_karma != null && (
                      <tr><td>Total Karma</td><td>{data.profile.total_karma.toLocaleString()}</td></tr>
                    )}
                    <tr><td>Profile URL</td><td><a href={data.profile?.profile_url} target="_blank" rel="noopener noreferrer">{data.profile?.profile_url}</a></td></tr>
                  </tbody>
                </table>
              </div>

              {/* Subreddits */}
              {data.top_subreddits?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Active Subreddits</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {data.top_subreddits.slice(0, 10).map((s) => (
                      <a key={s.subreddit} href={`https://reddit.com/r/${s.subreddit}`} target="_blank" rel="noopener noreferrer">
                        <span className="chip" style={{ cursor: 'pointer' }}>r/{s.subreddit} ({s.count})</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Top posts */}
              {data.top_posts?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Top Posts</div>
                  {data.top_posts.slice(0, 4).map((p, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                        {p.title}
                      </a>
                      <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 6 }}>
                        r/{p.subreddit} · {p.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </ScanCard>
  )
}
