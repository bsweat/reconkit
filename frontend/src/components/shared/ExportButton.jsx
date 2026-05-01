import { useProfileStore } from '../../store/profileStore'

export function ExportButton() {
  const { profile, results, discovered } = useProfileStore()

  const handleExport = () => {
    const data = {
      exported_at: new Date().toISOString(),
      profile,
      discovered,
      results,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reconkit-${profile.full_name?.replace(/\s+/g, '_') || profile.usernames?.[0] || 'export'}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button className="btn btn-ghost" onClick={handleExport} title="Export all results as JSON">
      ⬇ Export JSON
    </button>
  )
}
