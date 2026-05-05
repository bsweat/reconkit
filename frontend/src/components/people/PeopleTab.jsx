import { ProfileCard } from './ProfileCard'
import { UsernameSweepCard } from './UsernameSweepCard'
import { EmailCard } from './EmailCard'
import { PasteCard } from './PasteCard'
import { SocialIntelCard } from './SocialIntelCard'
import { DorksCard } from './DorksCard'

export function PeopleTab() {
  return (
    <div>
      <ProfileCard />
      {/* Full-width username sweep */}
      <UsernameSweepCard />
      {/* Two-up row: email + pastes */}
      <div className="scan-grid" style={{ marginTop: 12 }}>
        <EmailCard />
        <PasteCard />
      </div>
      {/* Compact horizontal social card (GitHub + Reddit + Keybase) */}
      <SocialIntelCard />
      {/* Google dorks */}
      <DorksCard />
    </div>
  )
}
