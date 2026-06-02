// ============================================================
// TelaSemAcesso — usuário sem role admin_ajd/comandante
// ============================================================
import { btnPrimary } from '../styles';

export default function TelaSemAcesso({ perfil, onVoltarPortal }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>🚫</div>
      <h2 className="font-heading" style={{
        color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 10,
      }}>
        Sem permissão
      </h2>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
        Você está autenticado, mas seu perfil{' '}
        <strong style={{ color: '#fbbf24' }}>{perfil?.role || '—'}</strong>{' '}
        não tem acesso ao módulo de procedimentos AJD.
      </p>
      <p style={{ color: '#64748b', fontSize: 12, marginBottom: 24 }}>
        Solicite ao Comandante a alteração do seu papel pra <code>admin_ajd</code>.
      </p>
      <button onClick={onVoltarPortal} style={{ ...btnPrimary, maxWidth: 280, margin: '0 auto' }}>
        ← Voltar ao Portal
      </button>
    </div>
  );
}
