import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_97rq307';
const EMAILJS_TEMPLATE_ID = 'template_y0wm9hp';
const EMAILJS_PUBLIC_KEY = 'VmM8b5g2hP9fKqsm-';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const SECOES = ['P1','P3','P4','P5','Conferência','Tesouraria','Secretaria','Almoxarifado','SMT','SMB','Rancho','Ordenança','AJD','PCSV','Ed. Física','Técnica','Obra','Faxina'];
const MOTIVOS = ['Folga','Concessão'];
const STATUS_COLORS = {
  pendente: { bg:'#FFF8E1', text:'#7B5800', border:'#FFD54F' },
  aprovado:  { bg:'#E8F5E9', text:'#1B5E20', border:'#A5D6A7' },
  recusado:  { bg:'#FFEBEE', text:'#B71C1C', border:'#EF9A9A' },
};

const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0dce8', fontSize:14, color:'#1a3a5c', background:'#f8fafc', boxSizing:'border-box', outline:'none' };
const lbl = { display:'block', fontSize:11, fontWeight:800, color:'#4a6580', marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 };
const btnPrimary = { display:'block', width:'100%', padding:'12px', background:'linear-gradient(135deg,#0d2340,#1e4d7b)', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:14, cursor:'pointer', marginTop:12 };
const btnSm = { padding:'6px 13px', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer', border:'none' };

function Card({ children, style }) {
  return <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 12px #00000012', marginBottom:10, ...style }}>{children}</div>;
}
function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pendente;
  return <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1 }}>{status}</span>;
}
function MotivoBadge({ motivo }) {
  const cor = motivo === 'Concessão'
    ? { bg:'#F3E5F5', text:'#6A1B9A', border:'#CE93D8' }
    : { bg:'#E3F2FD', text:'#0D47A1', border:'#90CAF9' };
  return <span style={{ background:cor.bg, color:cor.text, border:`1px solid ${cor.border}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>{motivo}</span>;
}
function Spinner() {
  return <div style={{ textAlign:'center', padding:40, color:'#6b8099', fontSize:15 }}>⏳ Carregando...</div>;
}

function TelaSolicitacao({ usuario }) {
  const [dia, setDia] = useState(null);
  const [semana, setSemana] = useState('');
  const [motivo, setMotivo] = useState('');
  const [email, setEmail] = useState('');
  const [minhas, setMinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);

  const carregarMinhas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('solicitacoes').select('*').eq('policial_id', usuario.id).order('created_at', { ascending: false });
    setMinhas(data || []);
    setLoading(false);
  }, [usuario.id]);

  useEffect(() => { carregarMinhas(); }, [carregarMinhas]);

  async function enviar() {
    if (!dia || !semana || !motivo) { setMsg({ tipo:'erro', texto:'Selecione o tipo, o dia e a semana.' }); return; }
    if (!email || !email.includes('@')) { setMsg({ tipo:'erro', texto:'Informe um email válido para receber a confirmação.' }); return; }
    setEnviando(true);
    const { error } = await supabase.from('solicitacoes').insert({
      policial_id: usuario.id, policial_nome: usuario.nome, matricula: usuario.matricula,
      patente: usuario.patente, secao: usuario.secao || '—', dia, semana, motivo,
      status: 'pendente', email_policial: email,
    });
    setEnviando(false);
    if (error) { setMsg({ tipo:'erro', texto:'Erro ao enviar. Tente novamente.' }); return; }
    setDia(null); setSemana(''); setMotivo(''); setEmail('');
    setMsg({ tipo:'ok', texto:'Solicitação enviada! Você receberá um email quando for aprovada ou recusada.' });
    setTimeout(() => setMsg(null), 4000);
    carregarMinhas();
  }

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, color:'#1a3a5c', marginBottom:4 }}>Nova Solicitação</h2>
      <p style={{ color:'#6b8099', fontSize:13, marginBottom:18 }}>Preencha e aguarde a aprovação do gestor.</p>
      <Card>
        <div style={{ background:'#f0f6ff', borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontWeight:800, color:'#1a3a5c' }}>{usuario.patente} {usuario.nome}</span>
          <span style={{ color:'#6b8099', fontSize:13 }}>Mat.: {usuario.matricula}</span>
          {usuario.secao ? <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:700 }}>{usuario.secao}</span>
            : <span style={{ background:'#fff3cd', color:'#856404', borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:700 }}>Seção não definida</span>}
        </div>

        <label style={lbl}>Tipo de solicitação *</label>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {MOTIVOS.map(m => (
            <button key={m} onClick={() => setMotivo(m)} style={{
              flex:1, padding:'14px 10px', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer',
              background: motivo === m ? (m === 'Folga' ? '#0D47A1' : '#6A1B9A') : '#f0f4f8',
              color: motivo === m ? '#fff' : '#2d4a63',
              border: motivo === m ? `2px solid ${m === 'Folga' ? '#0D47A1' : '#6A1B9A'}` : '2px solid transparent',
            }}>{m === 'Folga' ? '🌙 Folga' : '🎖️ Concessão'}</button>
          ))}
        </div>

        <label style={lbl}>Dia da semana *</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {DIAS.map(d => (
            <button key={d} onClick={() => setDia(d)} style={{
              padding:'7px 11px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer',
              background: dia === d ? '#1a3a5c' : '#f0f4f8', color: dia === d ? '#fff' : '#2d4a63',
              border: dia === d ? '2px solid #1a3a5c' : '2px solid transparent',
            }}>{d}</button>
          ))}
        </div>

        <label style={lbl}>Semana de referência *</label>
        <input type="week" value={semana} onChange={e => setSemana(e.target.value)} style={{ ...inp, marginBottom:14 }} />

        <label style={lbl}>Seu email para receber confirmação *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.email@gmail.com" style={{ ...inp, marginBottom:6 }} />

        {msg && <div style={{ padding:'10px 14px', borderRadius:8, marginTop:10, fontWeight:600, background:msg.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msg.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msg.texto}</div>}
        <button onClick={enviar} disabled={enviando} style={{ ...btnPrimary, opacity:enviando?0.7:1 }}>{enviando ? 'Enviando...' : 'Enviar Solicitação'}</button>
      </Card>

      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', margin:'22px 0 10px' }}>Minhas Solicitações</h3>
      {loading ? <Spinner /> : minhas.length === 0
        ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma solicitação registrada.</p>
        : minhas.map(s => (
          <Card key={s.id}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, alignItems:'center' }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <MotivoBadge motivo={s.motivo} />
                <span style={{ fontWeight:800, color:'#1a3a5c' }}>{s.dia}</span>
                <span style={{ color:'#6b8099', fontSize:13 }}>Semana: {s.semana}</span>
              </div>
              <Badge status={s.status} />
            </div>
            <p style={{ color:'#bbb', fontSize:12, marginTop:6 }}>Enviado em {new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
          </Card>
        ))
      }
    </div>
  );
}

function TelaGestor({ gestorLogado }) {
  const [aba, setAba] = useState('solicitacoes');
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [policiais, setPoliciais] = useState([]);
  const [gestores, setGestores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroSecao, setFiltroSecao] = useState('todas');
  const [filtroDia, setFiltroDia] = useState('todos');
  const [filtroMotivo, setFiltroMotivo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaMatricula, setNovaMatricula] = useState('');
  const [novaPatente, setNovaPatente] = useState('3º SGT PM');
  const [novaSecao, setNovaSecao] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState(null);
  const [novoGestorNome, setNovoGestorNome] = useState('');
  const [novoGestorMatricula, setNovoGestorMatricula] = useState('');
  const [novoGestorSenha, setNovoGestorSenha] = useState('');
  const [msgGestor, setMsgGestor] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [s, p, g] = await Promise.all([
      supabase.from('solicitacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('policiais').select('*').order('nome'),
      supabase.from('gestores').select('*').order('created_at'),
    ]);
    setSolicitacoes(s.data || []);
    setPoliciais(p.data || []);
    setGestores(g.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(id, status) {
    await supabase.from('solicitacoes').update({ status }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    const sol = solicitacoes.find(s => s.id === id);
    if (sol && sol.email_policial) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        email: sol.email_policial,
        nome: sol.policial_nome,
        motivo: sol.motivo,
        dia: sol.dia,
        semana: sol.semana,
        status: status === 'aprovado' ? '✅ APROVADA' : '❌ RECUSADA',
        secao: sol.secao,
        matricula: sol.matricula,
      });
    }
  }

  async function adicionarPolicial() {
    if (!novoNome.trim() || !novaMatricula.trim() || !novaSecao) return;
    const { data, error } = await supabase.from('policiais').insert({ nome: novoNome.toUpperCase(), matricula: novaMatricula, patente: novaPatente, secao: novaSecao }).select().single();
    if (!error && data) setPoliciais(prev => [...prev, data].sort((a,b) => a.nome.localeCompare(b.nome)));
    setNovoNome(''); setNovaMatricula(''); setNovaPatente('3º SGT PM'); setNovaSecao('');
  }

  async function removerPolicial(id) {
    if (!window.confirm('Confirmar remoção?')) return;
    await supabase.from('solicitacoes').delete().eq('policial_id', id);
    await supabase.from('policiais').delete().eq('id', id);
    setPoliciais(prev => prev.filter(p => p.id !== id));
    setSolicitacoes(prev => prev.filter(s => s.policial_id !== id));
  }

  async function editarSecao(id, secao) {
    await supabase.from('policiais').update({ secao }).eq('id', id);
    setPoliciais(prev => prev.map(p => p.id === id ? { ...p, secao } : p));
  }

  async function alterarMinhaSenha() {
    const mim = gestores.find(g => g.id === gestorLogado.id);
    if (!mim || mim.senha !== senhaAtual) { setMsgSenha({ tipo:'erro', texto:'Senha atual incorreta.' }); return; }
    if (novaSenha.length < 4) { setMsgSenha({ tipo:'erro', texto:'Nova senha deve ter no mínimo 4 caracteres.' }); return; }
    if (novaSenha !== confirmaSenha) { setMsgSenha({ tipo:'erro', texto:'Senhas não coincidem.' }); return; }
    await supabase.from('gestores').update({ senha: novaSenha }).eq('id', gestorLogado.id);
    setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('');
    setMsgSenha({ tipo:'ok', texto:'Senha alterada com sucesso!' });
    setTimeout(() => setMsgSenha(null), 3000);
  }

  async function adicionarGestor() {
    if (!novoGestorNome.trim() || !novoGestorMatricula.trim() || novoGestorSenha.length < 4) {
      setMsgGestor({ tipo:'erro', texto:'Preencha nome, matrícula e senha (mín. 4 caracteres).' }); return;
    }
    if (gestores.find(g => g.matricula === novoGestorMatricula)) {
      setMsgGestor({ tipo:'erro', texto:'Já existe um gestor com essa matrícula.' }); return;
    }
    const { data, error } = await supabase.from('gestores').insert({ nome: novoGestorNome.toUpperCase(), matricula: novoGestorMatricula, senha: novoGestorSenha, principal: false }).select().single();
    if (error) { setMsgGestor({ tipo:'erro', texto:'Erro ao cadastrar.' }); return; }
    setGestores(prev => [...prev, data]);
    setNovoGestorNome(''); setNovoGestorMatricula(''); setNovoGestorSenha('');
    setMsgGestor({ tipo:'ok', texto:'Gestor cadastrado com sucesso!' });
    setTimeout(() => setMsgGestor(null), 3000);
  }

  async function removerGestor(id) {
    if (!window.confirm('Remover este gestor?')) return;
    await supabase.from('gestores').delete().eq('id', id);
    setGestores(prev => prev.filter(g => g.id !== id));
  }

  const filtradas = solicitacoes
    .filter(s => filtroStatus === 'todos' || s.status === filtroStatus)
    .filter(s => filtroSecao === 'todas' || s.secao === filtroSecao)
    .filter(s => filtroDia === 'todos' || s.dia === filtroDia)
    .filter(s => filtroMotivo === 'todos' || s.motivo === filtroMotivo);

  const policiaisfiltrados = policiais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.matricula.includes(busca)
  );

  const stats = {
    total: solicitacoes.length,
    pendentes: solicitacoes.filter(s => s.status === 'pendente').length,
    aprovadas: solicitacoes.filter(s => s.status === 'aprovado').length,
    recusadas: solicitacoes.filter(s => s.status === 'recusado').length,
  };

  const ABAS = [
    { id:'solicitacoes', label:'📋 Solicitações' },
    { id:'efetivo', label:'👮 Efetivo' },
    { id:'gestores', label:'🗝️ Gestores' },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[{l:'Total',v:stats.total,c:'#1a3a5c'},{l:'Pendentes',v:stats.pendentes,c:'#7B5800'},{l:'Aprovadas',v:stats.aprovadas,c:'#1B5E20'},{l:'Recusadas',v:stats.recusadas,c:'#B71C1C'}]
          .map(s => <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'12px 8px', boxShadow:'0 2px 8px #00000012', textAlign:'center' }}><div style={{ fontSize:24, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {ABAS.map(a => <button key={a.id} onClick={() => setAba(a.id)} style={{ padding:'8px 16px', borderRadius:8, fontWeight:700, cursor:'pointer', background:aba===a.id?'#1a3a5c':'#f0f4f8', color:aba===a.id?'#fff':'#2d4a63', border:'none', fontSize:13 }}>{a.label}</button>)}
      </div>

      {aba === 'solicitacoes' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={inp}>
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="recusado">Recusado</option>
            </select>
            <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} style={inp}>
              <option value="todos">Folga e Concessão</option>
              <option value="Folga">Somente Folgas</option>
              <option value="Concessão">Somente Concessões</option>
            </select>
            <select value={filtroSecao} onChange={e => setFiltroSecao(e.target.value)} style={inp}>
              <option value="todas">Todas as seções</option>
              {SECOES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtroDia} onChange={e => setFiltroDia(e.target.value)} style={inp}>
              <option value="todos">Todos os dias</option>
              {DIAS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          {filtradas.length === 0
            ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma solicitação encontrada.</p>
            : filtradas.map(s => (
              <Card key={s.id}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div><span style={{ fontWeight:800, color:'#1a3a5c', fontSize:14 }}>{s.patente} {s.policial_nome}</span><span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>Mat. {s.matricula}</span></div>
                  <Badge status={s.status} />
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                  <MotivoBadge motivo={s.motivo} />
                  <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{s.secao}</span>
                  <span style={{ color:'#2d4a63', fontSize:13 }}>📅 <strong>{s.dia}</strong> — {s.semana}</span>
                </div>
                {s.email_policial && <p style={{ color:'#aab', fontSize:12, marginTop:4 }}>📧 {s.email_policial}</p>}
                <p style={{ color:'#bbb', fontSize:12, marginTop:4 }}>{new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
                {s.status === 'pendente' && (
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <button onClick={() => mudarStatus(s.id,'aprovado')} style={{ ...btnSm, background:'#1B5E20', color:'#fff' }}>✔ Aprovar</button>
                    <button onClick={() => mudarStatus(s.id,'recusado')} style={{ ...btnSm, background:'#B71C1C', color:'#fff' }}>✘ Recusar</button>
                  </div>
                )}
              </Card>
            ))
          }
        </>
      )}

      {aba === 'efetivo' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>➕ Adicionar Policial</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nome completo *</label><input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="NOME COMPLETO" style={inp} /></div>
              <div><label style={lbl}>Matrícula *</label><input value={novaMatricula} onChange={e => setNovaMatricula(e.target.value)} placeholder="99999" style={inp} /></div>
              <div><label style={lbl}>Patente</label>
                <select value={novaPatente} onChange={e => setNovaPatente(e.target.value)} style={inp}>
                  {['TEN CEL PM','MAJ PM','CAP PM','1º TEN PM','2º TEN PM','SUB TEN PM','1º SGT PM','2º SGT PM','3º SGT PM','CB PM','SD PM'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Seção *</label>
                <select value={novaSecao} onChange={e => setNovaSecao(e.target.value)} style={inp}>
                  <option value="">— Selecionar seção —</option>
                  {SECOES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={adicionarPolicial} style={{ ...btnPrimary, marginTop:12 }}>Adicionar ao Efetivo</button>
          </Card>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou matrícula..." style={{ ...inp, marginBottom:10 }} />
          <p style={{ color:'#6b8099', fontSize:12, marginBottom:10 }}>{policiaisfiltrados.length} policial(is)</p>
          {policiaisfiltrados.map(p => (
            <Card key={p.id} style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>{p.patente} {p.nome}</div>
                  <div style={{ color:'#6b8099', fontSize:12, marginTop:2 }}>Mat. {p.matricula}</div>
                  <div style={{ marginTop:8 }}>
                    <select value={p.secao || ''} onChange={e => editarSecao(p.id, e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 10px', width:'auto', minWidth:180 }}>
                      <option value="">— Seção não definida —</option>
                      {SECOES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => removerPolicial(p.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', marginTop:4 }}>Remover</button>
              </div>
            </Card>
          ))}
        </>
      )}

      {aba === 'gestores' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:4 }}>🔒 Alterar Minha Senha</h3>
            <p style={{ color:'#6b8099', fontSize:13, marginBottom:14 }}>Conectado como: <strong>{gestorLogado.nome}</strong></p>
            <label style={lbl}>Senha atual</label>
            <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="••••" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Nova senha</label>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Confirmar nova senha</label>
            <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} placeholder="Repita a nova senha" style={{ ...inp, marginBottom:6 }} />
            {msgSenha && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgSenha.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgSenha.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgSenha.texto}</div>}
            <button onClick={alterarMinhaSenha} style={btnPrimary}>Salvar Nova Senha</button>
          </Card>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:4 }}>➕ Cadastrar Novo Gestor</h3>
            <label style={lbl}>Nome / Patente *</label>
            <input value={novoGestorNome} onChange={e => setNovoGestorNome(e.target.value)} placeholder="Ex.: 1º SGT SILVA" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Matrícula *</label>
            <input value={novoGestorMatricula} onChange={e => setNovoGestorMatricula(e.target.value)} placeholder="Ex.: 80231" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Senha de acesso *</label>
            <input type="password" value={novoGestorSenha} onChange={e => setNovoGestorSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:6 }} />
            {msgGestor && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgGestor.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgGestor.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgGestor.texto}</div>}
            <button onClick={adicionarGestor} style={btnPrimary}>Cadastrar Gestor</button>
          </Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', margin:'20px 0 10px' }}>Gestores Cadastrados</h3>
          {gestores.map(g => (
            <Card key={g.id} style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div>
                  <span style={{ fontWeight:800, color:'#1a3a5c' }}>{g.nome}</span>
                  <span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>Mat. {g.matricula}</span>
                  {g.principal && <span style={{ background:'#FFF8E1', color:'#7B5800', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, marginLeft:8 }}>PRINCIPAL</span>}
                </div>
                {!g.principal && g.id !== gestorLogado.id && (
                  <button onClick={() => removerGestor(g.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C' }}>Remover</button>
                )}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [modo, setModo] = useState('login');
  const [usuarioSel, setUsuarioSel] = useState(null);
  const [gestorLogado, setGestorLogado] = useState(null);
  const [policiais, setPoliciais] = useState([]);
  const [senhaGestor, setSenhaGestor] = useState('');
  const [erroSenha, setErroSenha] = useState(false);
  const [buscaLogin, setBuscaLogin] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(true);

  useEffect(() => {
    supabase.from('policiais').select('*').order('nome')
      .then(({ data }) => { setPoliciais(data || []); setCarregandoLogin(false); });
  }, []);

  async function loginGestor() {
    const { data } = await supabase.from('gestores').select('*').eq('senha', senhaGestor).single();
    if (data) { setGestorLogado(data); setModo('gestor'); setErroSenha(false); }
    else setErroSenha(true);
  }

  function sair() {
    setModo('login'); setUsuarioSel(null); setGestorLogado(null);
    setSenhaGestor(''); setErroSenha(false); setBuscaLogin('');
  }

  const policiaisLogin = policiais.filter(p =>
    p.nome.toLowerCase().includes(buscaLogin.toLowerCase()) || p.matricula.includes(buscaLogin)
  );

  return (
    <div style={{ minHeight:'100vh', background:'#eef2f7', fontFamily:"'Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ background:'linear-gradient(135deg,#0d2340 0%,#1a3a5c 60%,#1e4d7b 100%)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 20px #00000040' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:42, width:42, objectFit:'contain' }} />
          <div>
            <div style={{ color:'#fff', fontWeight:900, fontSize:17, letterSpacing:0.5 }}>32º BPM — Controle de Folgas</div>
            <div style={{ color:'#8db4d8', fontSize:11 }}>PCSV · Expediente Semanal</div>
          </div>
        </div>
        {modo !== 'login' && <button onClick={sair} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:700 }}>← Sair</button>}
      </div>

      <div style={{ maxWidth:740, margin:'28px auto', padding:'0 14px' }}>
        {modo === 'login' && (
          <>
            <div style={{ textAlign:'center', marginBottom:26 }}>
              <h1 style={{ color:'#1a3a5c', fontWeight:900, fontSize:20, marginBottom:4 }}>Acesso ao Sistema</h1>
              <p style={{ color:'#6b8099', fontSize:13 }}>Selecione seu perfil para continuar</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 4px 20px #00000012' }}>
                <div style={{ fontSize:30, marginBottom:10 }}>👮</div>
                <h2 style={{ color:'#1a3a5c', fontWeight:800, fontSize:15, marginBottom:4 }}>Sou Policial</h2>
                <p style={{ color:'#6b8099', fontSize:12, marginBottom:14 }}>Solicitar folga / concessão e acompanhar status</p>
                <label style={lbl}>Buscar pelo nome</label>
                <input value={buscaLogin} onChange={e => setBuscaLogin(e.target.value)} placeholder="Digite seu nome..." style={{ ...inp, marginBottom:8 }} />
                <label style={lbl}>Selecione seu nome</label>
                {carregandoLogin ? <p style={{ color:'#aab', fontSize:13 }}>Carregando...</p> :
                  <select onChange={e => { const p = policiais.find(p => p.id === Number(e.target.value)); if (p) { setUsuarioSel(p); setModo('policial'); } }} defaultValue="" style={inp}>
                    <option value="" disabled>— Selecionar —</option>
                    {policiaisLogin.map(p => <option key={p.id} value={p.id}>{p.patente} {p.nome}</option>)}
                  </select>
                }
              </div>
              <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 4px 20px #00000012' }}>
                <div style={{ fontSize:30, marginBottom:10 }}>🗂️</div>
                <h2 style={{ color:'#1a3a5c', fontWeight:800, fontSize:15, marginBottom:4 }}>Sou Gestor</h2>
                <p style={{ color:'#6b8099', fontSize:12, marginBottom:14 }}>Aprovar solicitações e gerenciar efetivo</p>
                <label style={lbl}>Senha de acesso</label>
                <input type="password" value={senhaGestor} onChange={e => setSenhaGestor(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginGestor()} placeholder="••••" style={{ ...inp, marginBottom:6 }} />
                {erroSenha && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:4 }}>Senha incorreta.</p>}
                <button onClick={loginGestor} style={{ ...btnPrimary, marginTop:8 }}>Entrar como Gestor</button>
              </div>
            </div>
          </>
        )}
        {modo === 'policial' && usuarioSel && <TelaSolicitacao usuario={usuarioSel} />}
        {modo === 'gestor' && gestorLogado && <TelaGestor gestorLogado={gestorLogado} />}
      </div>
    </div>
  );
}
