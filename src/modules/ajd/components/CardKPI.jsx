// ============================================================
// CardKPI — cartão de indicador do dashboard
// ============================================================

export default function CardKPI({ valor, label, cor, icone, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${cor}`,
        borderRadius: 12,
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 6,
      }}>
        <span style={{
          color: '#64748b', fontSize: 10, fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{ fontSize: 22 }}>{icone}</span>
      </div>
      <div className="font-heading" style={{
        color: '#0f172a', fontWeight: 700, fontSize: 36, lineHeight: 1,
      }}>
        {valor}
      </div>
    </div>
  );
}

