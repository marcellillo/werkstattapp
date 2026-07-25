'use client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <p style={{ color: '#7f1d1d' }}>
          <strong>Admin Layout aktiv</strong>
        </p>
      </div>
      {children}
    </div>
  )
}
