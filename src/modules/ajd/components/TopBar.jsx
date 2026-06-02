// ============================================================
// TopBar do módulo AJD — com botão "← Portal" pra voltar
// ============================================================
import { btnGhost } from '../styles';

export default function TopBar({ admin, onVoltarPortal }) {
  return (
    <div style={{
      background: '#070f1e', borderTop: '3px solid #fbbf24',
      padding: '13px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onVoltarPortal && (
          <button onClick={onVoltarPortal} style={{
            ...btnGhost, padding: '8px 12px', marginRight: 4,
          }}>
            ← Portal
          </button>
        )}
        <div style={{
          width: 38, height: 38,
          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, color: '#0a1428', fontSize: 14, letterSpacing: 0.5,
        }}>
          AJD
        </div>
        <div>
          <div className="font-heading" style={{
            color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: 0.5,
          }}>
            AJD — Controle de Procedimentos
          </div>
          <div style={{
            color: '#475569', fontSize: 9, fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            Procedimentos Administrativos · v2.0
          </div>
        </div>
      </div>
      {admin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {admin.graduacao || ''} {admin.nome}
            </div>
            <div style={{ color: '#475569', fontSize: 10 }}>
              {admin.email}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
