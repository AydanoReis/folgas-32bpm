// ============================================================
// Toast — notificação flutuante no canto inferior direito
// ============================================================

export default function Toast({ msg, tipo }) {
  if (!msg) return null;
  const cores = {
    ok:   { bg: '#1B5E20', border: '#4CAF50' },
    erro: { bg: '#B71C1C', border: '#EF5350' },
    info: { bg: '#1565C0', border: '#42A5F5' },
  };
  const c = cores[tipo] || cores.info;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: c.bg, color: '#fff', padding: '14px 20px',
      borderRadius: 10, border: `1px solid ${c.border}`,
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      fontWeight: 600, fontSize: 13, maxWidth: 360,
    }}>
      {msg}
    </div>
  );
}
