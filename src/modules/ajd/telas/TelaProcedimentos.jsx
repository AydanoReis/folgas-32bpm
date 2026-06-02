// ============================================================
// TelaProcedimentos — tabela com filtros, busca, export CSV
// ============================================================
import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import {
  STATUS_CALCULADO, statusCalculado, diasRestantes,
  calcDataLimite, formatarData, exportarCSV, hojeISO,
} from '../utils';
import { inp, lbl, btnGhost, btnSm } from '../styles';
import SectionTitle from '../components/SectionTitle';
import StatusBadge from '../components/StatusBadge';
import ModalProcedimento from './ModalProcedimento';

export default function TelaProcedimentos({
  procedimentos, tipos, encarregados, onRecarregar, adminId, toast,
}) {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [editando, setEditando] = useState(null);

  function excluir(p) {
    if (!window.confirm(`Excluir o procedimento Nº ${p.numero}?`)) return;
    supabase.from('ajd_procedimentos').delete().eq('id', p.id).then(({ error }) => {
      if (error) toast('Erro ao excluir: ' + error.message, 'erro');
      else { toast('Procedimento excluído.', 'ok'); onRecarregar(); }
    });
  }

  const filtrados = procedimentos
    .filter((p) => {
      if (filtroTipo && p.tipo_id !== filtroTipo) return false;
      if (filtroStatus && statusCalculado(p) !== filtroStatus) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const txt = `${p.numero} ${p.tipo_nome} ${p.encarregado_label || ''} ${p.objeto || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ordem = {
        vencido: 0, proximo_vencimento: 1, dentro_prazo: 2,
        sobrestado: 3, concluido: 4,
      };
      return ordem[statusCalculado(a)] - ordem[statusCalculado(b)];
    });

  function exportar() {
    const rows = filtrados.map((p) => ({
      numero: p.numero,
      tipo: p.tipo_nome,
      encarregado: p.encarregado_label || '',
      instauracao: formatarData(p.data_instauracao),
      prazo: p.prazo_dias,
      prorrogacao: p.prorrogacao_dias || 0,
      limite: formatarData(calcDataLimite(p)),
      dias_restantes: diasRestantes(p),
      status: STATUS_CALCULADO[statusCalculado(p)]?.label,
      objeto: p.objeto || '',
    }));
    exportarCSV(rows, `procedimentos_${hojeISO()}.csv`);
  }

  return (
    <div>
      <SectionTitle
        icone="📋"
        titulo="Procedimentos"
        sub={`${procedimentos.length} cadastrados · ${filtrados.length} exibidos`}
      />

      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap',
        marginBottom: 16, alignItems: 'flex-end',
      }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={lbl}>Buscar</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Nº, tipo, encarregado, objeto..." style={inp} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={lbl}>Tipo</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={inp}>
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={lbl}>Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inp}>
            <option value="">Todos</option>
            {Object.entries(STATUS_CALCULADO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button onClick={exportar} style={btnGhost}>⬇ CSV</button>
        <button onClick={() => setEditando({})} style={{
          ...btnGhost, background: '#fbbf24', color: '#000', borderColor: '#fbbf24',
        }}>
          + Novo procedimento
        </button>
      </div>

      <div style={{
        background: '#0a1428', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, overflow: 'auto', maxHeight: '70vh',
      }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Tipo</th>
              <th>Encarregado</th>
              <th>Instauração</th>
              <th>Prazo</th>
              <th>Limite</th>
              <th>Dias rest.</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
                  {procedimentos.length === 0
                    ? 'Nenhum procedimento cadastrado. Clique em "Novo procedimento" para começar.'
                    : 'Nenhum resultado para os filtros aplicados.'}
                </td>
              </tr>
            )}
            {filtrados.map((p) => {
              const st = statusCalculado(p);
              const dr = diasRestantes(p);
              const limite = calcDataLimite(p);
              const rowClass =
                st === 'vencido' ? 'row-vencido' :
                st === 'proximo_vencimento' ? 'row-proximo' :
                st === 'sobrestado' ? 'row-sobrestado' :
                st === 'concluido' ? 'row-concluido' : '';
              return (
                <tr key={p.id} className={rowClass}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{p.numero}</td>
                  <td>{p.tipo_nome}</td>
                  <td style={{ fontSize: 12 }}>
                    {p.encarregado_label || <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{formatarData(p.data_instauracao)}</td>
                  <td style={{ fontSize: 12 }}>
                    {p.prazo_dias}d
                    {p.prorrogacao_dias > 0 && (
                      <span style={{ color: '#a855f7', marginLeft: 4 }}>
                        +{p.prorrogacao_dias}d
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{formatarData(limite)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {st === 'concluido' || st === 'sobrestado' ? (
                      <span style={{ color: '#475569' }}>—</span>
                    ) : (
                      <span
                        className={
                          dr !== null && dr <= 5 && dr >= 0 ? 'pulse-warn' :
                          dr < 0 ? 'pulse-danger' : ''
                        }
                        style={{
                          display: 'inline-block', minWidth: 36,
                          padding: '4px 8px', borderRadius: 6,
                          fontWeight: 800, fontSize: 13,
                          background: dr < 0 ? '#7f1d1d' : dr <= 5 ? '#78350f' : '#14532d',
                          color: dr < 0 ? '#fca5a5' : dr <= 5 ? '#fcd34d' : '#86efac',
                        }}
                      >
                        {dr}
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={st} dark /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditando(p)} style={{
                      ...btnSm, background: 'rgba(251,191,36,0.15)',
                      color: '#fbbf24', marginRight: 6,
                    }} title="Editar">✏️</button>
                    <button onClick={() => excluir(p)} style={{
                      ...btnSm, background: 'rgba(239,68,68,0.15)', color: '#f87171',
                    }} title="Excluir">🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <ModalProcedimento
          proc={editando.id ? editando : null}
          tipos={tipos}
          encarregados={encarregados}
          adminId={adminId}
          onFechar={() => setEditando(null)}
          onSalvar={() => {
            setEditando(null);
            onRecarregar();
            toast('Procedimento salvo!', 'ok');
          }}
        />
      )}
    </div>
  );
}
