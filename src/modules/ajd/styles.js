// ============================================================
// ESTILOS BASE COMPARTILHADOS (módulo AJD)
// ============================================================

export const inp = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1.5px solid rgba(255,255,255,0.1)',
  fontSize: 14,
  color: '#e2e8f0',
  background: 'rgba(255,255,255,0.04)',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s, background 0.2s',
};

export const lbl = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  color: '#64748b',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
};

export const btnPrimary = {
  display: 'block',
  width: '100%',
  padding: '13px',
  background: '#fbbf24',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  marginTop: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

export const btnGhost = {
  background: 'rgba(255,255,255,0.05)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export const btnSm = {
  padding: '6px 12px',
  borderRadius: 7,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  border: 'none',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

// Roles autorizados a acessar o módulo AJD
export const ROLES_AJD = ['admin_ajd', 'comandante'];
