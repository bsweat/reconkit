import { useProfileStore } from '../../store/profileStore'
import { ExportButton } from '../shared/ExportButton'

const TABS = [
  { id: 'people',   label: '▸ PEOPLE' },
  { id: 'networks', label: '▸ NETWORKS' },
]

export function TabBar() {
  const { activeTab, setActiveTab, scanStatus } = useProfileStore()

  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          {t.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {scanStatus === 'complete' && <ExportButton />}
    </div>
  )
}
