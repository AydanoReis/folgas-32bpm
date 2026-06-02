// ============================================================
// MenuLateral — navegação entre as abas do módulo AJD
// ============================================================

const ITENS = [
  { id: 'dashboard',     label: 'Dashboard',       icone: '📊' },
  { id: 'procedimentos', label: 'Procedimentos',   icone: '📋' },
  { id: 'encarregados',  label: 'Encarregados',    icone: '👮' },
  { id: 'tipos',         label: 'Tipos & Prazos',  icone: '⚙️' },
  { id: 'admins',        label: 'Administradores', icone: '🔐' },
];

export default function MenuLateral({ aba, setAba }) {
  return (
    <div style={{
      background: '#0a1428', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.05)',
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {ITENS.map((i) => (
        <button
          key={i.id}
          onClick={() => setAba(i.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', borderRadius: 8,
            background: aba === i.id ? 'rgba(251,191,36,0.12)' : 'transparent',
            color: aba === i.id ? '#fbbf24' : '#94a3b8',
            border: aba === i.id
              ? '1px solid rgba(251,191,36,0.25)'
              : '1px solid transparent',
            cursor: 'pointer', fontWeight: 700, fontSize: 13,
            textAlign: 'left', letterSpacing: '0.04em',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 16 }}>{i.icone}</span>
          {i.label}
        </button>
      ))}
    </div>
  );
}
