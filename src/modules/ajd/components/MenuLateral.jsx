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
      background: '#ffffff', borderRadius: 12,
      border: '1px solid #e2e8f0',
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
            color: aba === i.id ? '#b45309' : '#475569',
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

