// ============================================================
// ModalProcedimento — criar ou editar procedimento
// ============================================================
import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { hojeISO } from '../utils';
import { inp, lbl, btnGhost, btnSm } from '../styles';

export default function ModalProcedimento({
  proc, tipos, encarregados, onFechar, onSalvar, adminId,
}) {
  const [f, setF] = useState(
    proc || {
      numero: '',
      tipo_id: tipos[0]?.id || '',
      encarregado_id: '',
      data_instauracao: hojeISO(),
      prazo_dias: tipos[0]?.prazo_dias || 30,
      prorrogacao_dias: 0,
      data_prorrogacao: null,
      status: 'andamento',
      portaria_numero: '',
      portaria_data: null,
      objeto: '',
      observacoes: '',
      data_conclusao: null,
      desfecho: '',
    }
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function handleTipo(novoTipoId) {
    const tipo = tipos.find((t) => t.id === novoTipoId);
    setF((prev) => ({
      ...prev,
      tipo_id: novoTipoId,
      prazo_dias: tipo?.prazo_dias || prev.prazo_dias,
    }));
  }

  function set(k, v) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function salvar() {
    setErro('');
    if (!f.numero.trim()) { setErro('Informe o número do procedimento.'); return; }
    if (!f.tipo_id) { setErro('Selecione o tipo.'); return; }
    if (!f.data_instauracao) { setErro('Informe a data de instauração.'); return; }
    if (!f.prazo_dias || f.prazo_dias < 1) { setErro('Prazo inválido.'); return; }

    setSalvando(true);
    const payload = {
      numero: f.numero.trim(),
      tipo_id: f.tipo_id,
      encarregado_id: f.encarregado_id || null,
      data_instauracao: f.data_instauracao,
      prazo_dias: Number(f.prazo_dias),
      prorrogacao_dias: Number(f.prorrogacao_dias) || 0,
      data_prorrogacao: f.data_prorrogacao || null,
      status: f.status,
      portaria_numero: f.portaria_numero || null,
      portaria_data: f.portaria_data || null,
      objeto: f.objeto || null,
      observacoes: f.observacoes || null,
      data_conclusao: f.data_conclusao || null,
      desfecho: f.desfecho || null,
    };

    let res, savedId = proc?.id || null;
    if (proc?.id) {
      res = await supabase.from('ajd_procedimentos').update(payload).eq('id', proc.id);
    } else {
      res = await supabase
        .from('ajd_procedimentos')
        .insert({ ...payload, created_by: adminId })
        .select('id')
        .single();
      if (res.data?.id) savedId = res.data.id;
    }
    setSalvando(false);
    if (res.error) { setErro('Erro ao salvar: ' + res.error.message); return; }

    await supabase.from('ajd_historico_procedimento').insert({
      procedimento_id: savedId,
      admin_id: adminId,
      acao: proc?.id ? 'edicao' : 'criacao',
      detalhes: `Procedimento ${proc?.id ? 'editado' : 'criado'}: ${f.numero}`,
    });

    onSalvar();
  }

  const tipo = tipos.find((t) => t.id === f.tipo_id);
  const maxProrrog = tipo?.prorrogacao_dias || 0;
  const podeProrrogar = maxProrrog > 0;

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#0d1a2e', borderRadius: 14, padding: '24px 28px',
        maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 20,
        }}>
          <h2 className="font-heading" style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
            {proc?.id ? '✏️ Editar Procedimento' : '➕ Novo Procedimento'}
          </h2>
          <button onClick={onFechar} style={{ ...btnGhost, padding: '6px 12px' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={lbl}>Nº do procedimento *</label>
            <input value={f.numero} onChange={(e) => set('numero', e.target.value)}
                   placeholder="Ex: 001/2026" style={inp} />
          </div>
          <div>
            <label style={lbl}>Tipo *</label>
            <select value={f.tipo_id} onChange={(e) => handleTipo(e.target.value)} style={inp}>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Data de instauração *</label>
            <input type="date" value={f.data_instauracao || ''}
                   onChange={(e) => set('data_instauracao', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Encarregado</label>
            <select value={f.encarregado_id || ''}
                    onChange={(e) => set('encarregado_id', e.target.value)} style={inp}>
              <option value="">— sem encarregado —</option>
              {encarregados.map((e) => (
                <option key={e.id} value={e.id}>{e.graduacao} {e.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={lbl}>Prazo (dias) *</label>
            <input type="number" min="1" value={f.prazo_dias}
                   onChange={(e) => set('prazo_dias', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>
              Prorrogação (dias)
              {tipo && (
                <span style={{
                  color: '#64748b', textTransform: 'none',
                  letterSpacing: 0, marginLeft: 6, fontSize: 10,
                }}>
                  — máx. {maxProrrog}
                </span>
              )}
            </label>
            <input
              type="number" min="0" max={maxProrrog}
              value={f.prorrogacao_dias || 0}
              onChange={(e) => set('prorrogacao_dias', Math.min(Number(e.target.value), maxProrrog))}
              disabled={!podeProrrogar}
              style={{ ...inp, opacity: podeProrrogar ? 1 : 0.5 }}
            />
          </div>

          <div>
            <label style={lbl}>Status</label>
            <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inp}>
              <option value="andamento">Em andamento</option>
              <option value="sobrestado">Sobrestado</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Data da prorrogação</label>
            <input type="date" value={f.data_prorrogacao || ''}
                   onChange={(e) => set('data_prorrogacao', e.target.value || null)} style={inp} />
          </div>

          <div style={{
            gridColumn: 'span 2', marginTop: 10, paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <h3 style={{
              color: '#fbbf24', fontSize: 10, fontWeight: 800,
              letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12,
            }}>
              Origem (portaria)
            </h3>
          </div>
          <div>
            <label style={lbl}>Nº da portaria</label>
            <input value={f.portaria_numero || ''}
                   onChange={(e) => set('portaria_numero', e.target.value)}
                   style={inp} placeholder="Ex: PORT 045/2026" />
          </div>
          <div>
            <label style={lbl}>Data da portaria</label>
            <input type="date" value={f.portaria_data || ''}
                   onChange={(e) => set('portaria_data', e.target.value || null)} style={inp} />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Objeto / assunto</label>
            <textarea value={f.objeto || ''}
                      onChange={(e) => set('objeto', e.target.value)}
                      style={{ ...inp, minHeight: 60, resize: 'vertical' }}
                      placeholder="Resumo do que está sendo apurado..." />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Observações / histórico</label>
            <textarea value={f.observacoes || ''}
                      onChange={(e) => set('observacoes', e.target.value)}
                      style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                      placeholder="Andamentos, diligências realizadas, decisões..." />
          </div>

          {f.status === 'concluido' && (
            <>
              <div style={{
                gridColumn: 'span 2', marginTop: 10, paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <h3 style={{
                  color: '#fbbf24', fontSize: 10, fontWeight: 800,
                  letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12,
                }}>
                  Conclusão
                </h3>
              </div>
              <div>
                <label style={lbl}>Data da conclusão</label>
                <input type="date" value={f.data_conclusao || ''}
                       onChange={(e) => set('data_conclusao', e.target.value || null)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Desfecho</label>
                <input value={f.desfecho || ''}
                       onChange={(e) => set('desfecho', e.target.value)}
                       style={inp} placeholder="Ex: Arquivado, Indiciado..." />
              </div>
            </>
          )}
        </div>

        {erro && <p style={{ color: '#f87171', fontSize: 12, marginTop: 14 }}>{erro}</p>}

        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24,
        }}>
          <button onClick={onFechar} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{
            ...btnSm, background: '#fbbf24', color: '#000',
            padding: '10px 24px', fontSize: 12,
          }}>
            {salvando ? 'Salvando...' : proc?.id ? 'Salvar alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
