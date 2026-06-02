// ============================================================
// TelaAdmins — gestão de administradores (papéis admin_ajd/comandante)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { ROLES_AJD, btnGhost, btnSm } from '../styles';
import SectionTitle from '../components/SectionTitle';

export default function TelaAdmins({ adminLogado, toast }) {
  const [admins, setAdmins] = useState([]);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('perfis')
      .select('id, nome, graduacao, role, ativo, email_contato, created_at')
      .in('role', ROLES_AJD)
      .order('created_at', { ascending: true });
    setAdmins(data || []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function aviso(msg) {
    alert(
      msg + '\n\n' +
      'Por segurança, esta ação precisa do dashboard Supabase ' +
      '(ou da Edge Function admin-ajd-users, que ainda será criada).\n\n' +
      'Caminho manual:\n' +
      '1) Authentication → Users → Add user (email + senha)\n' +
      '2) Table editor → perfis → Insert (id do auth user, nome, graduacao, role=admin_ajd, ativo=true)'
    );
  }

  async function alternarAtivo(a) {
    if (a.id === adminLogado.id) {
      toast('Você não pode desativar a si mesmo.', 'erro');
      return;
    }
    const { error } = await supabase
      .from('perfis')
      .update({ ativo: !a.ativo })
      .eq('id', a.id);
    if (error) toast('Erro: ' + error.message, 'erro');
    else {
      toast(a.ativo ? 'Administrador desativado.' : 'Administrador reativado.', 'ok');
      carregar();
    }
  }

  const podeGerenciar = adminLogado.role === 'comandante';

  return (
    <div>
      <SectionTitle
        icone="🔐"
        titulo="Administradores"
        sub={`${admins.length} cadastrados · papéis admin_ajd e comandante`}
      />

      {podeGerenciar ? (
        <div style={{
          background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 20,
        }}>
          <h3 style={{
            color: '#fbbf24', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Cadastrar novo administrador
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
            Criar usuários no Supabase Auth exige permissão elevada. Use o dashboard,
            ou aguarde a Edge Function <code>admin-ajd-users</code>.
          </p>
          <button onClick={() => aviso('Criar novo administrador.')} style={{
            ...btnGhost, background: '#fbbf24', color: '#000', borderColor: '#fbbf24',
          }}>
            + Como cadastrar
          </button>
        </div>
      ) : (
        <div style={{
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 10, padding: '12px 16px',
          marginBottom: 20, color: '#93c5fd', fontSize: 12,
        }}>
          Apenas o <strong>Comandante</strong> pode gerenciar administradores.
        </div>
      )}

      <div style={{
        background: '#0a1428', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <table className="tbl-proc">
          <thead>
            <tr>
              <th>Graduação</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Status</th>
              {podeGerenciar && <th style={{ textAlign: 'right' }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan={podeGerenciar ? 6 : 5}
                    style={{ textAlign: 'center', padding: 30, color: '#475569' }}>
                  Nenhum administrador cadastrado.
                </td>
              </tr>
            )}
            {admins.map((a) => (
              <tr key={a.id} style={{ opacity: a.ativo ? 1 : 0.5 }}>
                <td style={{ color: '#fbbf24', fontWeight: 700 }}>{a.graduacao || '—'}</td>
                <td style={{ color: '#fff' }}>
                  {a.nome}
                  {a.id === adminLogado.id && (
                    <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 6 }}>
                      (você)
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12 }}>
                  {a.email_contato || <span style={{ color: '#475569' }}>—</span>}
                </td>
                <td style={{ fontSize: 11 }}>
                  <span style={{
                    background: a.role === 'comandante'
                      ? 'rgba(251,191,36,0.15)'
                      : 'rgba(59,130,246,0.15)',
                    color: a.role === 'comandante' ? '#fbbf24' : '#60a5fa',
                    padding: '3px 8px', borderRadius: 10,
                    fontWeight: 700, letterSpacing: '0.08em',
                  }}>
                    {a.role}
                  </span>
                </td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    padding: '3px 8px', borderRadius: 10,
                    letterSpacing: '0.1em',
                    background: a.ativo
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: a.ativo ? '#22c55e' : '#f87171',
                  }}>
                    {a.ativo ? 'ATIVO' : 'INATIVO'}
                  </span>
                </td>
                {podeGerenciar && (
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => aviso('Resetar senha de ' + a.nome + '.')} style={{
                      ...btnSm, background: 'rgba(59,130,246,0.15)',
                      color: '#60a5fa', marginRight: 6,
                    }}>🔑</button>
                    <button onClick={() => alternarAtivo(a)} style={{
                      ...btnSm,
                      background: a.ativo ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                      color: a.ativo ? '#f87171' : '#22c55e',
                    }}>
                      {a.ativo ? '🚫' : '✓'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
