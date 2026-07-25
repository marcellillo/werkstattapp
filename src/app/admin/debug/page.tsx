'use client'

export default function DebugPage() {
  return (
    <div style={{ padding: '40px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🔧 Debug Seite</h1>
      <p style={{ marginTop: '20px', color: '#666' }}>
        Wenn du das siehst, funktioniert das Admin-Layout!
      </p>

      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: '#d1fae5',
        borderRadius: '8px',
        color: '#047857'
      }}>
        ✅ Admin-Layout funktioniert korrekt
      </div>

      <div style={{ marginTop: '20px', color: '#666' }}>
        <p>Versuch jetzt: <a href="/admin/mitarbeiter" style={{ color: 'blue' }}>Zu Mitarbeiter</a></p>
      </div>
    </div>
  )
}
