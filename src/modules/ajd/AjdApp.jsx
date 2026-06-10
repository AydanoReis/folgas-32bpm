// ============================================================
// AjdApp — entrada do módulo AJD (rodado de dentro do Portal Folgas)
// ============================================================
//
// Diferenças em relação ao App.js antigo (standalone):
//
// - NÃO faz login, troca de senha, recuperação ou bootstrapping
//   de sessão. O Portal Folgas já cuidou disso e nos passa
//   perfil + session prontos.
// - NÃO renderiza SplashLogin. Já entra direto no app.
// - Verifica role (admin_ajd / comandante). Se não tiver, mostra
//   TelaSemAcesso com botão "Voltar ao Portal".
// - TopBar tem botão "← Portal" que chama `onVoltarPortal`.
//
// Props esperadas:
//   - perfil: objeto da tabela `perfis` do usuário logado
//   - session: sessão Supabase Auth (pra pegar email do user)
//   - onVoltarPortal: callback pra voltar ao Portal Folgas
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { ROLES_AJD } from './styles';

import Toast from './components/Toast';
import TopBar from './components/TopBar';
import MenuLateral from './components/MenuLateral';

import Dashboard from './telas/Dashboard';
import TelaProcedimentos from './telas/TelaProcedimentos';
import TelaEncarregados from './telas/TelaEncarregados';
import TelaTipos from './telas/TelaTipos';
import TelaAdmins from './telas/TelaAdmins';
import TelaSemAcesso from './telas/TelaSemAcesso';

export default function AjdApp({ perfil, session, onVoltarPortal }) {
  const [aba, setAba] = useState('dashboard');
  const [procedimentos, setProcedimentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [encarregados, setEncarregados] = useState([]);
  const [toastMsg, setToastMsg] = useState({ msg: '', tipo: 'info' });
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function toast(msg, tipo = 'info') {
    setToastMsg({ msg, tipo });
    setTimeout(() => setToastMsg({ msg: '', tipo: 'info' }), 3500);
  }

  const carregar = useCallback(async () => {
    const [pRes, tRes, eRes] = await Promise.all([
      supabase
        .from('ajd_procedimentos')
        .select(
          '*, tipo:ajd_procedimento_tipos(nome), encarregado:ajd_encarregados(graduacao, nome, telefone)'
        )
        .order('created_at', { ascending: false }),
      supabase.from('ajd_procedimento_tipos').select('*').order('ordem'),
      supabase.from('ajd_encarregados').select('*').order('nome'),
    ]);
    const procs = (pRes.data || []).map((p) => ({
      ...p,
      tipo_nome: p.tipo?.nome || p.tipo_id,
      encarregado_label: p.encarregado
        ? `${p.encarregado.graduacao} ${p.encarregado.nome}`
        : null,
      encarregado_telefone: p.encarregado?.telefone || null,
    }));
    setProcedimentos(procs);
    setTipos(tRes.data || []);
    setEncarregados(eRes.data || []);
  }, []);

  const podeAcessar =
    perfil && perfil.ativo && ROLES_AJD.includes(perfil.role);

  useEffect(() => {
    if (podeAcessar) carregar();
  }, [podeAcessar, carregar]);

  // ============== SEM ACESSO ==============
  if (!podeAcessar) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <TopBar admin={null} onVoltarPortal={onVoltarPortal} />
        <div style={{
          maxWidth: 1400, margin: '24px auto', padding: '0 16px',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '28px 26px',
          }}>
            <TelaSemAcesso perfil={perfil} onVoltarPortal={onVoltarPortal} />
          </div>
        </div>
        <Toast msg={toastMsg.msg} tipo={toastMsg.tipo} />
      </div>
    );
  }

  // ============== APP NORMAL ==============
  const admin = {
    id: perfil.id,
    nome: perfil.nome,
    graduacao: perfil.graduacao || perfil.patente || '',
    email: session?.user?.email || perfil.email_contato || '',
    role: perfil.role,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <TopBar admin={admin} onVoltarPortal={onVoltarPortal} />
      <div style={{
        maxWidth: 1400, margin: '24px auto', padding: '0 16px',
        display: 'grid', gap: 18,
        gridTemplateColumns: isDesktop ? '220px 1fr' : '1fr',
      }}>
        <MenuLateral aba={aba} setAba={setAba} />
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '28px 26px', color: '#0f172a',
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {aba === 'dashboard' && (
            <Dashboard procedimentos={procedimentos} tipos={tipos} onIrPara={setAba} />
          )}
          {aba === 'procedimentos' && (
            <TelaProcedimentos
              procedimentos={procedimentos} tipos={tipos}
              encarregados={encarregados} onRecarregar={carregar}
              adminId={admin.id} toast={toast}
            />
          )}
          {aba === 'encarregados' && (
            <TelaEncarregados
              encarregados={encarregados} onRecarregar={carregar} toast={toast}
            />
          )}
          {aba === 'tipos' && (
            <TelaTipos tipos={tipos} onRecarregar={carregar} toast={toast} />
          )}
          {aba === 'admins' && (
            <TelaAdmins adminLogado={admin} toast={toast} />
          )}
        </div>
      </div>
      <Toast msg={toastMsg.msg} tipo={toastMsg.tipo} />
    </div>
  );
}

