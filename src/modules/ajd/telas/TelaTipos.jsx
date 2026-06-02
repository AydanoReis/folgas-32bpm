// ============================================================
// TelaTipos — edição de prazos por tipo de procedimento
// ============================================================
import { supabase } from '../../../supabaseClient';
import { inp } from '../styles';
import SectionTitle from '../components/SectionTitle';

export default function TelaTipos({ tipos, onRecarregar, toast }) {
  async function salvar(id, campo, valor) {
    const { error } = await supabase
      .from('ajd_procedimento_tipos')
      .update({ [campo]: Number(valor) })
      .eq('id', id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast('Atualizado.', 'ok'); onRecarregar(); }
  }

  return (
    <div>
      <SectionTitle
        icone="⚙️"
        titulo="Tipos de Procedimentos & Prazos"
        sub="Edite os prazos padrão de cada tipo. Os prazos só afetam procedimentos novos — os existentes mantêm o prazo salvo."
      />

      <div style={{
        background: '#0a1428', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Prazo padrão (dias)</th>
              <th>Prorrogação máxima (dias)</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id}>
                <td style={{ color: '#fff', fontWeight: 700 }}>{t.nome}</td>
                <td>
                  <input
                    type="number" min="1" defaultValue={t.prazo_dias}
                    onBlur={(e) => {
                      if (Number(e.target.value) !== t.prazo_dias) {
                        salvar(t.id, 'prazo_dias', e.target.value);
                      }
                    }}
                    style={{ ...inp, maxWidth: 120 }}
                  />
                </td>
                <td>
                  <input
                    type="number" min="0" defaultValue={t.prorrogacao_dias}
                    onBlur={(e) => {
                      if (Number(e.target.value) !== t.prorrogacao_dias) {
                        salvar(t.id, 'prorrogacao_dias', e.target.value);
                      }
                    }}
                    style={{ ...inp, maxWidth: 120 }}
                  />
                </td>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>
                  {t.prazo_dias + t.prorrogacao_dias} dias
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
