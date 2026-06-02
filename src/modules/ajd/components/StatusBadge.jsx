// ============================================================
// StatusBadge — badge colorida por status de procedimento
// ============================================================
import { STATUS_CALCULADO } from '../utils';

export default function StatusBadge({ status, dark = false }) {
  const s = STATUS_CALCULADO[status] || STATUS_CALCULADO.dentro_prazo;
  const bg = dark ? s.bgDark : s.bg;
  const tx = dark ? s.textDark : s.text;
  return (
    <span style={{
      background: bg, color: tx, padding: '4px 10px', borderRadius: 20,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
      border: dark ? 'none' : `1px solid ${s.border}`,
    }}>
      {s.icone} {s.label}
    </span>
  );
}
