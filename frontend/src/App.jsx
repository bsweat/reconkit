import { useProfileStore } from './store/profileStore'
import { ProfilePanel } from './components/layout/ProfilePanel'
import { TabBar } from './components/layout/TabBar'
import { PeopleTab } from './components/people/PeopleTab'
import { NetworksTab } from './components/networks/NetworksTab'

export default function App() {
  const { activeTab } = useProfileStore()

  return (
    <div className="app-layout">
      <ProfilePanel />
      <div className="results-area">
        <TabBar />
        <div className="results-content">
          {activeTab === 'people'   && <PeopleTab />}
          {activeTab === 'networks' && <NetworksTab />}
        </div>
      </div>
    </div>
  )
}
