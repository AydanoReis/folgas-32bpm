import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const EMAILJS_SERVICE_ID = 'service_97rq307';
const EMAILJS_TEMPLATE_ID = 'template_y0wm9hp';
const EMAILJS_PUBLIC_KEY = 'VmM8b5g2hP9fKqsm-';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const SECOES = ['P1','P3','P4','P5','Conferência','Tesouraria','Secretaria','Almoxarifado','SMT','SMB','Rancho','Ordenança','AJD','PCSV','Ed. Física','Técnica','Obra','Faxina'];
const MOTIVOS = ['Folga','Concessão'];
const SIT_SANITARIA = ['Apto A','Apto B','Apto C'];
const SITUACOES = ['Pronto','Férias','LE','LTSPF','LTS','LP','Núpcias','Luto'];
const RESTRICOES = ['Sem restrição','SP','CD','CRD'];
const COR_SS = { 'Apto A':'#1565C0', 'Apto B':'#F9A825', 'Apto C':'#B71C1C' };
const EMOJI_SS = { 'Apto A':'🔵', 'Apto B':'🟡', 'Apto C':'🔴' };
const STATUS_COLORS = {
  pendente: { bg:'#FFF8E1', text:'#7B5800', border:'#FFD54F' },
  aprovado:  { bg:'#E8F5E9', text:'#1B5E20', border:'#A5D6A7' },
  recusado:  { bg:'#FFEBEE', text:'#B71C1C', border:'#EF9A9A' },
};
const CORES_GRAFICO = ['#1a3a5c','#2E7D32','#6A1B9A','#0D47A1','#B71C1C','#E65100','#00695C','#4A148C','#880E4F','#1B5E20','#F57F17','#37474F','#1565C0','#283593','#4E342E','#33691E','#006064','#01579B'];

const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0dce8', fontSize:14, color:'#1a3a5c', background:'#f8fafc', boxSizing:'border-box', outline:'none' };
const lbl = { display:'block', fontSize:11, fontWeight:800, color:'#4a6580', marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 };
const btnPrimary = { display:'block', width:'100%', padding:'12px', background:'linear-gradient(135deg,#0d2340,#1e4d7b)', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:14, cursor:'pointer', marginTop:12 };
const btnSm = { padding:'6px 13px', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer', border:'none' };

// Utilitários de semana
function getInicioSemana(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}
function formatarSemana(inicio) {
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);
  return `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;
}
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
function SSBadge({ ss }) {
  return <span style={{ background: COR_SS[ss] || '#888', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{EMOJI_SS[ss]} {ss}</span>;
}
function SituacaoBadge({ situacao }) {
  const cor = situacao === 'Pronto' ? { bg:'#E8F5E9', text:'#1B5E20' } : { bg:'#FFEBEE', text:'#B71C1C' };
  return <span style={{ background:cor.bg, color:cor.text, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{situacao}</span>;
}
function Spinner() {
  return <div style={{ textAlign:'center', padding:40, color:'#6b8099', fontSize:15 }}>⏳ Carregando...</div>;
}

function gerarPDF(solicitacoes) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  if (aprovadas.length === 0) { alert('Nenhuma folga aprovada para gerar relatório.'); return; }
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(13, 35, 64);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('32º BPM — Controle de Folgas', pageW / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`PCSV · Expediente Semanal · Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pageW / 2, 21, { align: 'center' });
  let y = 35;
  doc.setTextColor(0, 0, 0);
  DIAS.forEach(dia => {
    const dodia = aprovadas.filter(s => s.dia === dia);
    if (dodia.length === 0) return;
    const porSecao = {};
    dodia.forEach(s => { if (!porSecao[s.secao]) porSecao[s.secao] = []; porSecao[s.secao].push(s); });
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(30, 77, 123);
    doc.rect(10, y, pageW - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(dia.toUpperCase() + '-FEIRA', 14, y + 5.5);
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    Object.entries(porSecao).forEach(([secao, pols]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const nomes = pols.map(p => `${p.patente} ${p.policial_nome} (${p.motivo})`).join(', ');
      doc.setFont('helvetica', 'bold');
      doc.text(`${secao}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      const linhas = doc.splitTextToSize(nomes, pageW - 50);
      doc.text(linhas, 40, y);
      y += linhas.length * 5 + 2;
    });
    y += 4;
  });
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFillColor(13, 35, 64);
  doc.rect(10, y, pageW - 20, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO GERAL POR SEÇÃO E DIA', 14, y + 5.5);
  y += 12;
  const todasSecoes = [...new Set(aprovadas.map(s => s.secao))].sort();
  const head = [['Seção', ...DIAS.map(d => d.substring(0,3))]];
  const body = todasSecoes.map(secao => [secao, ...DIAS.map(dia => { const count = aprovadas.filter(s => s.secao === secao && s.dia === dia).length; return count > 0 ? String(count) : '-'; })]);
  doc.autoTable({ startY: y, head, body, theme: 'grid', headStyles: { fillColor: [30, 77, 123], textColor: 255, fontStyle: 'bold', fontSize: 8 }, bodyStyles: { fontSize: 8 }, columnStyles: { 0: { fontStyle: 'bold' } }, margin: { left: 10, right: 10 } });
  doc.save(`relatorio-folgas-32bpm-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`);
}

function Dashboard({ solicitacoes, policiais }) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const total = solicitacoes.length;
  const totalAprovadas = aprovadas.length;
  const totalPendentes = solicitacoes.filter(s => s.status === 'pendente').length;
  const totalRecusadas = solicitacoes.filter(s => s.status === 'recusado').length;
  const totalFolgas = aprovadas.filter(s => s.motivo === 'Folga').length;
  const totalConcessoes = aprovadas.filter(s => s.motivo === 'Concessão').length;
  const porDia = DIAS.map(dia => ({ dia: dia.substring(0,3), Folgas: aprovadas.filter(s => s.dia === dia && s.motivo === 'Folga').length, Concessões: aprovadas.filter(s => s.dia === dia && s.motivo === 'Concessão').length }));
  const porSecao = SECOES.map(secao => ({ secao, total: aprovadas.filter(s => s.secao === secao).length })).filter(s => s.total > 0).sort((a,b) => b.total - a.total);
  const diaMais = porDia.reduce((a,b) => (a.Folgas+a.Concessões) >= (b.Folgas+b.Concessões) ? a : b, porDia[0]);
  const secaoMais = porSecao[0];
  const ssData = SIT_SANITARIA.map(ss => ({ ss, total: policiais.filter(p => (p.sit_sanitaria || 'Apto A') === ss).length }));
  const sitData = SITUACOES.map(s => ({ name:s, value: policiais.filter(p => (p.situacao || 'Pronto') === s).length })).filter(s => s.value > 0);

  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:16 }}>📈 Dashboard de Estatísticas</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        {[{l:'Total',v:total,c:'#1a3a5c'},{l:'Folgas aprovadas',v:totalFolgas,c:'#0D47A1'},{l:'Concessões aprovadas',v:totalConcessoes,c:'#6A1B9A'},{l:'Pendentes',v:totalPendentes,c:'#7B5800'},{l:'Recusadas',v:totalRecusadas,c:'#B71C1C'},{l:'Total aprovadas',v:totalAprovadas,c:'#1B5E20'}]
          .map(s => <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'14px 10px', boxShadow:'0 2px 8px #00000012', textAlign:'center' }}><div style={{ fontSize:26, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
      </div>
      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Situação Sanitária do Efetivo</h4>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {ssData.map(s => (
            <div key={s.ss} style={{ flex:1, minWidth:100, background:COR_SS[s.ss]+'18', borderRadius:10, padding:'14px 10px', textAlign:'center', border:`2px solid ${COR_SS[s.ss]}` }}>
              <div style={{ fontSize:24 }}>{EMOJI_SS[s.ss]}</div>
              <div style={{ fontSize:22, fontWeight:900, color:COR_SS[s.ss] }}>{s.total}</div>
              <div style={{ fontSize:12, color:'#6b8099', fontWeight:700 }}>{s.ss}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Situação do Efetivo</h4>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {sitData.map(s => (
            <div key={s.name} style={{ background:s.name==='Pronto'?'#E8F5E9':'#FFEBEE', borderRadius:8, padding:'8px 14px', textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:900, color:s.name==='Pronto'?'#1B5E20':'#B71C1C' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.name}</div>
            </div>
          ))}
        </div>
      </Card>
      {aprovadas.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <Card style={{ margin:0, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#6b8099', fontWeight:700, marginBottom:4 }}>DIA MAIS SOLICITADO</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#1a3a5c' }}>{diaMais.dia}</div>
            <div style={{ fontSize:12, color:'#6b8099' }}>{diaMais.Folgas+diaMais.Concessões} folgas</div>
          </Card>
          <Card style={{ margin:0, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#6b8099', fontWeight:700, marginBottom:4 }}>SEÇÃO MAIS ATIVA</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#1a3a5c' }}>{secaoMais?secaoMais.secao:'—'}</div>
            <div style={{ fontSize:12, color:'#6b8099' }}>{secaoMais?`${secaoMais.total} folgas`:''}</div>
          </Card>
        </div>
      )}
      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Folgas aprovadas por dia da semana</h4>
        {aprovadas.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma folga aprovada ainda.</p>
          : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porDia} margin={{ top:5, right:10, left:-20, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Folgas" fill="#0D47A1" radius={[4,4,0,0]} />
                <Bar dataKey="Concessões" fill="#6A1B9A" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
        }
      </Card>
      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Folgas aprovadas por seção</h4>
        {porSecao.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma folga aprovada ainda.</p>
          : <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porSecao} dataKey="total" nameKey="secao" cx="50%" cy="50%" outerRadius={80} label={({ secao, total }) => `${secao}: ${total}`} labelLine={false} fontSize={10}>
                    {porSecao.map((_,i) => <Cell key={i} fill={CORES_GRAFICO[i%CORES_GRAFICO.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {porSecao.map((s,i) => <span key={s.secao} style={{ background:CORES_GRAFICO[i%CORES_GRAFICO.length], color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{s.secao}: {s.total}</span>)}
              </div>
            </>
        }
      </Card>
    </div>
  );
}

function CalendarioFolgas({ solicitacoes }) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const [filtroSecao, setFiltroSecao] = useState('todas');
  const filtradas = filtroSecao === 'todas' ? aprovadas : aprovadas.filter(s => s.secao === filtroSecao);
  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', margin:0 }}>📅 Calendário de Folgas Aprovadas</h3>
        <select value={filtroSecao} onChange={e => setFiltroSecao(e.target.value)} style={{ ...inp, width:'auto', minWidth:160 }}>
          <option value="todas">Todas as seções</option>
          {SECOES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700 }}>🌙 Folga</span>
        <span style={{ background:'#F3E5F5', color:'#6A1B9A', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700 }}>🎖️ Concessão</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead><tr>{DIAS.map(d => <th key={d} style={{ background:'#1a3a5c', color:'#fff', padding:'10px 6px', fontSize:12, fontWeight:800, textAlign:'center', border:'1px solid #0d2340' }}>{d}</th>)}</tr></thead>
          <tbody>
            <tr>
              {DIAS.map(dia => {
                const dodia = filtradas.filter(s => s.dia === dia);
                return (
                  <td key={dia} style={{ verticalAlign:'top', padding:6, border:'1px solid #d0dce8', background:'#f8fafc', minWidth:80 }}>
                    {dodia.length === 0 ? <span style={{ color:'#ccc', fontSize:11 }}>—</span>
                      : dodia.map(s => (
                        <div key={s.id} style={{ background:s.motivo==='Concessão'?'#F3E5F5':'#E3F2FD', color:s.motivo==='Concessão'?'#6A1B9A':'#0D47A1', borderRadius:6, padding:'4px 6px', marginBottom:4, fontSize:11, fontWeight:700 }}>
                          <div>{s.policial_nome.split(' ').slice(0,2).join(' ')}</div>
                          <div style={{ fontSize:10, opacity:0.8 }}>{s.secao}</div>
                        </div>
                      ))
                    }
                    {dodia.length > 0 && <div style={{ fontSize:10, color:'#6b8099', marginTop:2, textAlign:'right' }}>{dodia.length} folga{dodia.length>1?'s':''}</div>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {aprovadas.length === 0 && <p style={{ color:'#aab', fontSize:13, textAlign:'center', marginTop:20 }}>Nenhuma folga aprovada ainda.</p>}
    </div>
  );
}

function LoginPolicial({ onLogin }) {
  const [policiais, setPoliciais] = useState([]);
  const [buscaLogin, setBuscaLogin] = useState('');
  const [policialSel, setPolicialSel] = useState(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState('login');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.from('policiais').select('*').order('nome')
      .then(({ data }) => { setPoliciais(data || []); setCarregando(false); });
  }, []);

  const policiaisFiltrados = policiais.filter(p =>
    p.nome.toLowerCase().includes(buscaLogin.toLowerCase()) || p.matricula.includes(buscaLogin)
  );

  async function entrar() {
    if (!policialSel) { setErro('Selecione seu nome.'); return; }
    if (!senha) { setErro('Digite sua senha.'); return; }
    if (!policialSel.senha) { setModo('cadastrar'); return; }
    if (policialSel.senha !== senha) { setErro('Senha incorreta.'); return; }
    onLogin(policialSel);
  }

  async function cadastrarSenha() {
    if (novaSenha.length !== 4 || isNaN(novaSenha)) { setErro('A senha deve ter exatamente 4 números.'); return; }
    if (novaSenha !== confirmarSenha) { setErro('As senhas não coincidem.'); return; }
    await supabase.from('policiais').update({ senha: novaSenha }).eq('id', policialSel.id);
    onLogin({ ...policialSel, senha: novaSenha });
  }

  if (modo === 'cadastrar') return (
    <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 4px 20px #00000012' }}>
      <div style={{ fontSize:30, marginBottom:10 }}>🔐</div>
      <h2 style={{ color:'#1a3a5c', fontWeight:800, fontSize:15, marginBottom:4 }}>Primeiro acesso</h2>
      <p style={{ color:'#6b8099', fontSize:12, marginBottom:16 }}>Olá, <strong>{policialSel.nome}</strong>! Cadastre uma senha de 4 números.</p>
      <label style={lbl}>Nova senha (4 números)</label>
      <input type="password" maxLength={4} value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} placeholder="••••" style={{ ...inp, marginBottom:10 }} />
      <label style={lbl}>Confirmar senha</label>
      <input type="password" maxLength={4} value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} placeholder="••••" style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:6 }}>{erro}</p>}
      <button onClick={cadastrarSenha} style={btnPrimary}>Cadastrar Senha e Entrar</button>
    </div>
  );

  return (
    <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 4px 20px #00000012' }}>
      <div style={{ fontSize:30, marginBottom:10 }}>👮</div>
      <h2 style={{ color:'#1a3a5c', fontWeight:800, fontSize:15, marginBottom:4 }}>Sou Policial</h2>
      <p style={{ color:'#6b8099', fontSize:12, marginBottom:14 }}>Selecione seu nome e digite sua senha</p>
      <label style={lbl}>Buscar pelo nome</label>
      <input value={buscaLogin} onChange={e => { setBuscaLogin(e.target.value); setPolicialSel(null); }} placeholder="Digite seu nome..." style={{ ...inp, marginBottom:8 }} />
      <label style={lbl}>Selecione seu nome</label>
      {carregando ? <p style={{ color:'#aab', fontSize:13 }}>Carregando...</p> :
        <select onChange={e => { const p = policiais.find(p => p.id === Number(e.target.value)); setPolicialSel(p||null); setErro(''); }} value={policialSel?.id||''} style={{ ...inp, marginBottom:10 }}>
          <option value="" disabled>— Selecionar —</option>
          {policiaisFiltrados.map(p => <option key={p.id} value={p.id}>{p.patente} {p.nome}</option>)}
        </select>
      }
      <label style={lbl}>Senha (4 números)</label>
      <input type="password" maxLength={4} value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key==='Enter'&&entrar()} placeholder="••••" style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:6 }}>{erro}</p>}
      <button onClick={entrar} style={btnPrimary}>Entrar</button>
      <p style={{ color:'#aab', fontSize:11, marginTop:8, textAlign:'center' }}>Primeiro acesso? Selecione seu nome e clique em Entrar.</p>
    </div>
  );
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

  const naoProto = usuario.situacao && usuario.situacao !== 'Pronto';

  async function enviar() {
    if (naoProto) return;
    if (!dia || !semana || !motivo) { setMsg({ tipo:'erro', texto:'Selecione o tipo, o dia e a data.' }); return; }
    if (!email || !email.includes('@')) { setMsg({ tipo:'erro', texto:'Informe um email válido.' }); return; }
    setEnviando(true);
    const { error } = await supabase.from('solicitacoes').insert({
      policial_id: usuario.id, policial_nome: usuario.nome, matricula: usuario.matricula,
      patente: usuario.patente, secao: usuario.secao || '—', dia, semana, motivo,
      status: 'pendente', email_policial: email,
    });
    setEnviando(false);
    if (error) { setMsg({ tipo:'erro', texto:'Erro ao enviar. Tente novamente.' }); return; }
    setDia(null); setSemana(''); setMotivo(''); setEmail('');
    setMsg({ tipo:'ok', texto:'Solicitação enviada!' });
    setTimeout(() => setMsg(null), 4000);
    carregarMinhas();
  }

  async function cancelarSolicitacao(id) {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    await supabase.from('solicitacoes').delete().eq('id', id);
    setMinhas(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, color:'#1a3a5c', marginBottom:4 }}>Nova Solicitação</h2>
      <Card>
        <div style={{ background:'#f0f6ff', borderRadius:8, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontWeight:800, color:'#1a3a5c' }}>{usuario.patente} {usuario.nome}</span>
          <span style={{ color:'#6b8099', fontSize:13 }}>Mat.: {usuario.matricula}</span>
          {usuario.secao && <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:700 }}>{usuario.secao}</span>}
          <SSBadge ss={usuario.sit_sanitaria||'Apto A'} />
          <SituacaoBadge situacao={usuario.situacao||'Pronto'} />
          {usuario.restricao && usuario.restricao !== 'Sem restrição' && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{usuario.restricao}</span>}
        </div>
        {naoProto ? (
          <div style={{ background:'#FFEBEE', borderRadius:8, padding:'14px', textAlign:'center', color:'#B71C1C', fontWeight:700 }}>
            ⚠️ Você está classificado como <strong>{usuario.situacao}</strong> e não pode solicitar folga no momento.
          </div>
        ) : (
          <>
            <label style={lbl}>Tipo de solicitação *</label>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {MOTIVOS.map(m => (
                <button key={m} onClick={() => setMotivo(m)} style={{ flex:1, padding:'14px 10px', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer', background:motivo===m?(m==='Folga'?'#0D47A1':'#6A1B9A'):'#f0f4f8', color:motivo===m?'#fff':'#2d4a63', border:motivo===m?`2px solid ${m==='Folga'?'#0D47A1':'#6A1B9A'}`:'2px solid transparent' }}>{m==='Folga'?'🌙 Folga':'🎖️ Concessão'}</button>
              ))}
            </div>
            <label style={lbl}>Dia da semana *</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {DIAS.map(d => <button key={d} onClick={() => setDia(d)} style={{ padding:'7px 11px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', background:dia===d?'#1a3a5c':'#f0f4f8', color:dia===d?'#fff':'#2d4a63', border:dia===d?'2px solid #1a3a5c':'2px solid transparent' }}>{d}</button>)}
            </div>
            <label style={lbl}>Data de referência *</label>
            <input type="date" value={semana} onChange={e => setSemana(e.target.value)} style={{ ...inp, marginBottom:14 }} />
            <label style={lbl}>Seu email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.email@gmail.com" style={{ ...inp, marginBottom:6 }} />
            {msg && <div style={{ padding:'10px 14px', borderRadius:8, marginTop:10, fontWeight:600, background:msg.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msg.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msg.texto}</div>}
            <button onClick={enviar} disabled={enviando} style={{ ...btnPrimary, opacity:enviando?0.7:1 }}>{enviando?'Enviando...':'Enviar Solicitação'}</button>
          </>
        )}
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
                <span style={{ color:'#6b8099', fontSize:13 }}>{s.semana}</span>
              </div>
              <Badge status={s.status} />
            </div>
            <p style={{ color:'#bbb', fontSize:12, marginTop:6 }}>Enviado em {new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
            {s.status === 'pendente' && <button onClick={() => cancelarSolicitacao(s.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', marginTop:8 }}>✕ Cancelar</button>}
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
  const [semanaAtual, setSemanaAtual] = useState(() => getInicioSemana(new Date()));
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

  function semanaAnterior() { const d = new Date(semanaAtual); d.setDate(d.getDate()-7); setSemanaAtual(d); }
  function proximaSemana() { const d = new Date(semanaAtual); d.setDate(d.getDate()+7); setSemanaAtual(d); }

  // Filtra solicitações pela semana selecionada
  const fimSemana = new Date(semanaAtual);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const isoInicio = semanaAtual.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];

  const solicitacoesSemana = solicitacoes.filter(s => s.semana >= isoInicio && s.semana <= isoFim);

  const filtradas = solicitacoesSemana
    .filter(s => filtroStatus === 'todos' || s.status === filtroStatus)
    .filter(s => filtroSecao === 'todas' || s.secao === filtroSecao)
    .filter(s => filtroDia === 'todos' || s.dia === filtroDia)
    .filter(s => filtroMotivo === 'todos' || s.motivo === filtroMotivo);

  const policiaisfiltrados = policiais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.matricula.includes(busca)
  );

  const stats = {
    total: solicitacoesSemana.length,
    pendentes: solicitacoesSemana.filter(s => s.status === 'pendente').length,
    aprovadas: solicitacoesSemana.filter(s => s.status === 'aprovado').length,
    recusadas: solicitacoesSemana.filter(s => s.status === 'recusado').length,
  };

  async function mudarStatus(id, status) {
    await supabase.from('solicitacoes').update({ status }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    const sol = solicitacoes.find(s => s.id === id);
    if (sol && sol.email_policial && status !== 'pendente') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { email:sol.email_policial, nome:sol.policial_nome, motivo:sol.motivo, dia:sol.dia, semana:sol.semana, status:status==='aprovado'?'✅ APROVADA':'❌ RECUSADA', secao:sol.secao, matricula:sol.matricula });
    }
  }

  async function excluirSolicitacao(id) {
    if (!window.confirm('Excluir esta solicitação?')) return;
    await supabase.from('solicitacoes').delete().eq('id', id);
    setSolicitacoes(prev => prev.filter(s => s.id !== id));
  }

  async function resetarSenhaPolicial(id, nome) {
    if (!window.confirm(`Resetar a senha de ${nome}?`)) return;
    await supabase.from('policiais').update({ senha:'' }).eq('id', id);
    alert('Senha resetada!');
  }

  async function atualizarPolicial(id, campo, valor) {
    await supabase.from('policiais').update({ [campo]:valor }).eq('id', id);
    setPoliciais(prev => prev.map(p => p.id === id ? { ...p, [campo]:valor } : p));
  }

  async function adicionarPolicial() {
    if (!novoNome.trim() || !novaMatricula.trim() || !novaSecao) return;
    const { data, error } = await supabase.from('policiais').insert({ nome:novoNome.toUpperCase(), matricula:novaMatricula, patente:novaPatente, secao:novaSecao, senha:'', sit_sanitaria:'Apto A', situacao:'Pronto', restricao:'Sem restrição' }).select().single();
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

  async function alterarMinhaSenha() {
    const mim = gestores.find(g => g.id === gestorLogado.id);
    if (!mim || mim.senha !== senhaAtual) { setMsgSenha({ tipo:'erro', texto:'Senha atual incorreta.' }); return; }
    if (novaSenha.length < 4) { setMsgSenha({ tipo:'erro', texto:'Mínimo 4 caracteres.' }); return; }
    if (novaSenha !== confirmaSenha) { setMsgSenha({ tipo:'erro', texto:'Senhas não coincidem.' }); return; }
    await supabase.from('gestores').update({ senha:novaSenha }).eq('id', gestorLogado.id);
    setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('');
    setMsgSenha({ tipo:'ok', texto:'Senha alterada!' });
    setTimeout(() => setMsgSenha(null), 3000);
  }

  async function adicionarGestor() {
    if (!novoGestorNome.trim() || !novoGestorMatricula.trim() || novoGestorSenha.length < 4) { setMsgGestor({ tipo:'erro', texto:'Preencha todos os campos.' }); return; }
    if (gestores.find(g => g.matricula === novoGestorMatricula)) { setMsgGestor({ tipo:'erro', texto:'Matrícula já cadastrada.' }); return; }
    const { data, error } = await supabase.from('gestores').insert({ nome:novoGestorNome.toUpperCase(), matricula:novoGestorMatricula, senha:novoGestorSenha, principal:false }).select().single();
    if (error) { setMsgGestor({ tipo:'erro', texto:'Erro ao cadastrar.' }); return; }
    setGestores(prev => [...prev, data]);
    setNovoGestorNome(''); setNovoGestorMatricula(''); setNovoGestorSenha('');
    setMsgGestor({ tipo:'ok', texto:'Gestor cadastrado!' });
    setTimeout(() => setMsgGestor(null), 3000);
  }

  async function removerGestor(id) {
    if (!window.confirm('Remover este gestor?')) return;
    await supabase.from('gestores').delete().eq('id', id);
    setGestores(prev => prev.filter(g => g.id !== id));
  }

  const ABAS = [
    { id:'solicitacoes', label:'📋 Solicitações' },
    { id:'calendario',   label:'📅 Calendário' },
    { id:'estatisticas', label:'📈 Estatísticas' },
    { id:'efetivo',      label:'👮 Efetivo' },
    { id:'gestores',     label:'🗝️ Gestores' },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      {/* Cards de resumo da semana */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[{l:'Total',v:stats.total,c:'#1a3a5c'},{l:'Pendentes',v:stats.pendentes,c:'#7B5800'},{l:'Aprovadas',v:stats.aprovadas,c:'#1B5E20'},{l:'Recusadas',v:stats.recusadas,c:'#B71C1C'}]
          .map(s => <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'12px 8px', boxShadow:'0 2px 8px #00000012', textAlign:'center' }}><div style={{ fontSize:24, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {ABAS.map(a => <button key={a.id} onClick={() => setAba(a.id)} style={{ padding:'8px 14px', borderRadius:8, fontWeight:700, cursor:'pointer', background:aba===a.id?'#1a3a5c':'#f0f4f8', color:aba===a.id?'#fff':'#2d4a63', border:'none', fontSize:12 }}>{a.label}</button>)}
      </div>

      {aba === 'solicitacoes' && (
        <>
          {/* Navegador de semana */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', borderRadius:10, padding:'10px 16px', marginBottom:14, boxShadow:'0 2px 8px #00000012' }}>
            <button onClick={semanaAnterior} style={{ ...btnSm, background:'#f0f4f8', color:'#1a3a5c' }}>← Anterior</button>
            <span style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>📅 {formatarSemana(semanaAtual)}</span>
            <button onClick={proximaSemana} style={{ ...btnSm, background:'#f0f4f8', color:'#1a3a5c' }}>Próxima →</button>
          </div>

          <button onClick={() => gerarPDF(solicitacoesSemana)} style={{ ...btnPrimary, marginTop:0, marginBottom:14, background:'linear-gradient(135deg,#1B5E20,#2E7D32)' }}>📄 Gerar Relatório PDF</button>

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
            ? <p style={{ color:'#aab', fontSize:13, textAlign:'center', padding:20 }}>Nenhuma solicitação nesta semana.</p>
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
                {s.status === 'recusado' && <button onClick={() => excluirSolicitacao(s.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', marginTop:8 }}>🗑️ Excluir</button>}
                {s.status === 'aprovado' && <button onClick={() => mudarStatus(s.id,'pendente')} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800', marginTop:8 }}>↩️ Revogar aprovação</button>}
              </Card>
            ))
          }
        </>
      )}

      {aba === 'calendario' && <Card><CalendarioFolgas solicitacoes={solicitacoes} /></Card>}
      {aba === 'estatisticas' && <Dashboard solicitacoes={solicitacoes} policiais={policiais} />}

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
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                    <div><label style={{ ...lbl, fontSize:10 }}>Seção</label>
                      <select value={p.secao||''} onChange={e => atualizarPolicial(p.id,'secao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>
                        <option value="">— Não definida —</option>
                        {SECOES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Sit. Sanitária</label>
                      <select value={p.sit_sanitaria||'Apto A'} onChange={e => atualizarPolicial(p.id,'sit_sanitaria',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>
                        {SIT_SANITARIA.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Situação</label>
                      <select value={p.situacao||'Pronto'} onChange={e => atualizarPolicial(p.id,'situacao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>
                        {SITUACOES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Restrições</label>
                      <select value={p.restricao||'Sem restrição'} onChange={e => atualizarPolicial(p.id,'restricao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>
                        {RESTRICOES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <SSBadge ss={p.sit_sanitaria||'Apto A'} />
                    <SituacaoBadge situacao={p.situacao||'Pronto'} />
                    {p.restricao && p.restricao !== 'Sem restrição' && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{p.restricao}</span>}
                    <button onClick={() => resetarSenhaPolicial(p.id, p.nome)} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800' }}>🔑 Resetar senha</button>
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
                {!g.principal && g.id !== gestorLogado.id && <button onClick={() => removerGestor(g.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C' }}>Remover</button>}
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
  const [senhaGestor, setSenhaGestor] = useState('');
  const [erroSenha, setErroSenha] = useState(false);

  async function loginGestor() {
    const { data } = await supabase.from('gestores').select('*').eq('senha', senhaGestor).single();
    if (data) { setGestorLogado(data); setModo('gestor'); setErroSenha(false); }
    else setErroSenha(true);
  }

  function sair() { setModo('login'); setUsuarioSel(null); setGestorLogado(null); setSenhaGestor(''); setErroSenha(false); }

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
              <LoginPolicial onLogin={p => { setUsuarioSel(p); setModo('policial'); }} />
              <div style={{ background:'#fff', borderRadius:14, padding:22, boxShadow:'0 4px 20px #00000012' }}>
                <div style={{ fontSize:30, marginBottom:10 }}>🗂️</div>
                <h2 style={{ color:'#1a3a5c', fontWeight:800, fontSize:15, marginBottom:4 }}>Sou Gestor</h2>
                <p style={{ color:'#6b8099', fontSize:12, marginBottom:14 }}>Aprovar solicitações e gerenciar efetivo</p>
                <label style={lbl}>Senha de acesso</label>
                <input type="password" value={senhaGestor} onChange={e => setSenhaGestor(e.target.value)} onKeyDown={e => e.key==='Enter'&&loginGestor()} placeholder="••••" style={{ ...inp, marginBottom:6 }} />
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
