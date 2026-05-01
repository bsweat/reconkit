import { ProfileCard } from './ProfileCard'
import { UsernameSweepCard } from './UsernameSweepCard'
import { GitHubCard } from './GitHubCard'
import { EmailCard } from './EmailCard'
import { RedditCard } from './RedditCard'
import { KeybaseCard } from './KeybaseCard'
import { PasteCard } from './PasteCard'
import { DorksCard } from './DorksCard'

export function PeopleTab() {
  return (
    <div>
      <ProfileCard />
      <div className="scan-grid">
        <UsernameSweepCard />
        <GitHubCard />
        <EmailCard />
        <RedditCard />
        <KeybaseCard />
        <PasteCard />
      </div>
      <DorksCard />
    </div>
  )
}
