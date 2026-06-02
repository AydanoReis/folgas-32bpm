// ============================================================
// TelaEncarregados — CRUD de encarregados
// ============================================================
import { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { PATENTES, normalizarTelefone, formatarTelefone } from '../utils';
import { inp, lbl, btnGhost, btnSm } from '../styles';
import SectionTitle from '../components/SectionTitle';

export default function TelaEncarregados({ encarregados, onRecarregar, toast }) {
  const [f, setF] = useState({ graduacao: 'CB PM', nome: '', rg: '', telefone: '' });
  const [editandoId, setEditandoId] = useState(null);

  async function salvar() {
    if (!f.nome.trim()) { toast('Informe o nome.', 'erro'); return; }
    const payload = {
      graduacao: f.graduacao,
      nome: f.nome.trim().toUpperCase(),
      rg: f.rg || null,
      telefone: normalizarTelefone(f.telefone) || null,
    };
    let res;
    if (editandoId) {
      res = await supabase.from('ajd_encarregados').update(payload).eq('id', editandoId);
    } else {
      res = await supabase.from('ajd_encarregados').insert(payload);
    }
    if (res.error) toast('Erro: ' + res.error.message, 'erro');
    else {
      toast(editandoId ? 'Encarregado atualizado.' : 'Encarregado cadastrado.', 'ok');
      setF({ graduacao: 'CB PM', nome: '', rg: '', telefone: '' });
      setEditandoId(null);
      onRecarregar();
    }
  }

  function editar(e) {
    setF({
      graduacao: e.graduacao,
      nome: e.nome,
      rg: e.rg || '',
      telefone: e.telefone || '',
    });
    setEditandoId(e.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function excluir(e) {
    if (!window.confirm(`Excluir o encarregado ${e.nome}?`)) return;
    const { error } = await supabase.from('ajd_encarregados').delete().eq('id', e.id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else { toast('Excluído.', 'ok'); onRecarregar(); }
  }

  return (
    <div>
      <SectionTitle icone="👮" titulo="Encarregados" sub={`${encarregados.length} cadastrados`} />

      <div style={{
        background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '18px 20px', marginBottom: 20,
      }}>
        <h3 style={{
          color: '#fbbf24', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          {editandoId ? 'Editar encarregado' : 'Novo encarregado'}
        </h3>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: '140px 1fr 160px 200px auto',
          alignItems: 'flex-end',
        }}>
          <div>
            <label style={lbl}>Graduação</label>
            <select value={f.graduacao}
                    onChange={(e) => setF({ ...f, graduacao: e.target.value })}
                    style={inp}>
              {PATENTES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nome completo</label>
            <input value={f.nome}
                   onChange={(e) => setF({ ...f, nome: e.target.value })}
                   placeholder="NOME COMPLETO" style={inp} />
          </div>
          <div>
            <label style={lbl}>RG / Matrícula</label>
            <input value={f.rg}
                   onChange={(e) => setF({ ...f, rg: e.target.value })}
                   placeholder="000000-0" style={inp} />
          </div>
          <div>
            <label style={lbl}>Telefone (WhatsApp)</label>
            <input value={f.telefone}
                   onChange={(e) => setF({ ...f, telefone: e.target.value })}
                   placeholder="(21) 99999-9999" style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {editandoId && (
              <button onClick={() => {
                setF({ graduacao: 'CB PM', nome: '', rg: '', telefone: '' });
                setEditandoId(null);
              }} style={btnGhost}>
                Cancelar
              </button>
            )}
            <button onClick={salvar} style={{
              ...btnGhost, background: '#fbbf24', color: '#000', borderColor: '#fbbf24',
            }}>
              {editandoId ? 'Salvar' : '+ Adicionar'}
            </button>
          </div>
        </div>
      </div>

      <div style={{
        background: '#0a1428', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Graduação</th>
              <th>Nome</th>
              <th>RG</th>
              <th>Telefone</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {encarregados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 30, color: '#475569' }}>
                  Nenhum encarregado cadastrado.
                </td>
              </tr>
            )}
            {encarregados.map((e) => (
              <tr key={e.id}>
                <td style={{ fontWeight: 700, color: '#fbbf24' }}>{e.graduacao}</td>
                <td style={{ color: '#fff' }}>{e.nome}</td>
                <td>{e.rg || <span style={{ color: '#475569' }}>—</span>}</td>
                <td style={{ fontSize: 12 }}>{formatarTelefone(e.telefone)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => editar(e)} style={{
                    ...btnSm, background: 'rgba(251,191,36,0.15)',
                    color: '#fbbf24', marginRight: 6,
                  }}>✏️</button>
                  <button onClick={() => excluir(e)} style={{
                    ...btnSm, background: 'rgba(239,68,68,0.15)', color: '#f87171',
                  }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
