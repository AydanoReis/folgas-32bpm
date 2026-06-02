// ============================================================
// SectionTitle — título de seção com barra amarela à esquerda
// ============================================================

export default function SectionTitle({ icone, titulo, sub }) {
  return (
    <div style={{
      marginBottom: 18, paddingBottom: 14,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 3, height: 22, background: '#fbbf24' }} />
        <h2 className="font-heading" style={{
          color: '#fff', fontWeight: 700, fontSize: 24, margin: 0,
        }}>
          {icone} {titulo}
        </h2>
      </div>
      {sub && (
        <p style={{ color: '#475569', fontSize: 12, marginLeft: 13 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
