import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  paginar,
  validarEmail,
  validarMatricula,
  validarSenha,
  rateLimiterSolicitacao,
  rateLimiterAprovacao,
  registrarHistorico,
  exportarParaCSV,
  exportarParaExcel,
  formatarData,
  formatarDataHora,
  CORES_STATUS,
  COR_SS,
  EMOJI_SS,
  ComponentePaginacao,
  DetalhesPolicialCard,
} from './utils';

const EMAILJS_SERVICE_ID = 'service_97rq307';
const EMAILJS_TEMPLATE_ID = 'template_y0wm9hp';
const EMAILJS_PUBLIC_KEY = 'VmM8b5g2hP9fKqsm-';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const SECOES = ['P1','P3','P4','P5','Conferência','Tesouraria','Secretaria','Almoxarifado','SMT','SMB','Rancho','Ordenança','AJD','PCSV','Ed. Física','Técnica','Obra','Faxina','Gabinete Médico','Gabinete Odontológico'];
const MOTIVOS = ['Folga','Concessão'];
const SIT_SANITARIA_LTS = ['Apto A','Apto B','Apto C','LTS'];
const SITUACOES = ['Pronto','Férias','LE','LTSPF','LTS','LP','Núpcias','Luto'];
const RESTRICOES = ['Sem restrição','SP','CD','CRD','CHR'];
const FUNCOES_GESTOR = ['','Comandante','SubComandante','Comandante de Cia','Chefe da P1','Brigada','Sargenteante'];

const AUTO_REFRESH_INTERVAL = 120000; // 2 minutos (otimizado)
const POR_PAGINA = 15; // Paginação: 15 itens por página

const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0dce8', fontSize:14, color:'#1a3a5c', background:'#f8fafc', boxSizing:'border-box', outline:'none' };
const lbl = { display:'block', fontSize:11, fontWeight:800, color:'#4a6580', marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 };
const btnPrimary = { display:'block', width:'100%', padding:'12px', background:'linear-gradient(135deg,#0d2340,#1e4d7b)', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:14, cursor:'pointer', marginTop:12 };
const btnSm = { padding:'6px 13px', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer', border:'none' };

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

function diasParaRetorno(fimStr) {
  if (!fimStr) return null;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const fim = new Date(fimStr + 'T00:00:00');
  return Math.ceil((fim - hoje) / (1000*60*60*24));
}

function temRestricao(p) {
  return p.restricao && p.restricao !== 'Sem restrição';
}

function nivelLabel(g) {
  if (g.principal) return { label:'PRINCIPAL', bg:'#0d2340', color:'#fff' };
  if (g.nivel === 'master') return { label:'MASTER', bg:'#1B5E20', color:'#fff' };
  return { label:'GESTOR', bg:'#f0f4f8', color:'#6b8099' };
}

function salvarSessao(tipo, dados) {
  try { sessionStorage.setItem('sessao_tipo', tipo); sessionStorage.setItem('sessao_dados', JSON.stringify(dados)); } catch(e) {}
}

function carregarSessao() {
  try { const tipo = sessionStorage.getItem('sessao_tipo'); const dados = sessionStorage.getItem('sessao_dados'); return tipo && dados ? { tipo, dados: JSON.parse(dados) } : null; } catch(e) { return null; }
}

function limparSessao() {
  try { sessionStorage.removeItem('sessao_tipo'); sessionStorage.removeItem('sessao_dados'); } catch(e) {}
}

function Card({ children, style }) {
  return <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 12px #00000012', marginBottom:10, ...style }}>{children}</div>;
}

function Badge({ status }) {
  const s = CORES_STATUS[status] || CORES_STATUS.pendente;
  return <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1 }}>{status}</span>;
}

function MotivoBadge({ motivo }) {
  const cor = motivo === 'Concessão' ? { bg:'#F3E5F5', text:'#6A1B9A', border:'#CE93D8' } : { bg:'#E3F2FD', text:'#0D47A1', border:'#90CAF9' };
  return <span style={{ background:cor.bg, color:cor.text, border:`1px solid ${cor.border}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>{motivo}</span>;
}

function SSBadge({ p }) {
  const ss = p.sit_sanitaria || 'Apto A';
  const cor = COR_SS[ss] || '#888';
  const emoji = EMOJI_SS[ss] || '⚪';
  const comRestricao = temRestricao(p) && ss === 'Apto A';
  return (
    <span style={{ background: comRestricao ? '#E65100' : cor, color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>
      {comRestricao ? '🟠' : emoji} {comRestricao ? `Apto A (${p.restricao})` : ss}
    </span>
  );
}

function SituacaoBadge({ situacao }) {
  const cor = situacao === 'Pronto' ? { bg:'#E8F5E9', text:'#1B5E20' } : { bg:'#FFEBEE', text:'#B71C1C' };
  return <span style={{ background:cor.bg, color:cor.text, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{situacao}</span>;
}

function Spinner() {
  return <div style={{ textAlign:'center', padding:40, color:'#6b8099', fontSize:15 }}>⏳ Carregando...</div>;
}

// ========== GERADOR DE PDF (mantém o original) ==========
function gerarPDF(solicitacoes, policiais, semanaAtual) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const pendentes = solicitacoes.filter(s => s.status === 'pendente');
  const recusadas = solicitacoes.filter(s => s.status === 'recusado');
  const folgas = aprovadas.filter(s => s.motivo === 'Folga');
  const concessoes = aprovadas.filter(s => s.motivo === 'Concessão');
  const fimSemana = new Date(semanaAtual);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const periodoStr = `${semanaAtual.toLocaleDateString('pt-BR')} a ${fimSemana.toLocaleDateString('pt-BR')}`;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const contPorDia = DIAS.map(dia => ({ dia, count: aprovadas.filter(s => s.dia === dia).length }));
  const diaMaisAtivo = contPorDia.reduce((a,b) => a.count >= b.count ? a : b, contPorDia[0]);
  const contPorSecao = SECOES.map(secao => ({ secao, count: aprovadas.filter(s => s.secao === secao).length })).filter(s => s.count > 0).sort((a,b) => b.count - a.count);
  const secaoMais = contPorSecao[0];
  const statusOp = pendentes.length === 0 ? 'NORMAL' : pendentes.length <= 3 ? 'ATENÇÃO' : 'CRÍTICO';
  const corStatusOp = statusOp === 'NORMAL' ? [27,94,32] : statusOp === 'ATENÇÃO' ? [123,88,0] : [183,28,28];
  const isoInicio = semanaAtual.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];
  const prontos = policiais.filter(p => (p.situacao||'Pronto') === 'Pronto');
  const semFolga = prontos.filter(p => !solicitacoes.find(s => s.policial_id === p.id && s.semana >= isoInicio && s.semana <= isoFim && s.status !== 'recusado'));
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(13,35,64); doc.rect(0,0,pageW,55,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('POLÍCIA MILITAR DO ESTADO DO RIO DE JANEIRO', pageW/2, 14, { align:'center' });
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text('32º BATALHÃO DE POLÍCIA MILITAR', pageW/2, 25, { align:'center' });
  doc.setFontSize(13); doc.setFont('helvetica','normal');
  doc.text('CONTROLE SEMANAL DE FOLGAS — PCSV', pageW/2, 35, { align:'center' });
  doc.setFontSize(10);
  doc.text(`Período: ${periodoStr}   |   Emitido: ${hoje}`, pageW/2, 44, { align:'center' });
  doc.text('Responsável: PCSV / Expediente Semanal', pageW/2, 51, { align:'center' });
  let y = 65;
  const cards = [
    { label:'Solicitações', valor:solicitacoes.length, cor:[13,35,64] },
    { label:'Aprovadas', valor:aprovadas.length, cor:[27,94,32] },
    { label:'Pendentes', valor:pendentes.length, cor:[123,88,0] },
    { label:'Recusadas', valor:recusadas.length, cor:[183,28,28] },
  ];
  const cardW = (pageW - 20 - 9) / 4;
  cards.forEach((c, i) => {
    const x = 10 + i * (cardW + 3);
    doc.setFillColor(...c.cor); doc.rect(x, y, cardW, 22, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text(String(c.valor), x + cardW/2, y + 13, { align:'center' });
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(c.label.toUpperCase(), x + cardW/2, y + 19, { align:'center' });
  });
  y += 30;
  doc.setFillColor(240,244,248); doc.rect(10,y,pageW-20,48,'F');
  doc.setDrawColor(200,210,220); doc.rect(10,y,pageW-20,48,'S');
  doc.setTextColor(13,35,64); doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('RESUMO EXECUTIVO', 16, y+8);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
  [
    `• Dia com maior concentração: ${diaMaisAtivo.count > 0 ? `${diaMaisAtivo.dia}-feira (${diaMaisAtivo.count} folga${diaMaisAtivo.count>1?'s':''})` : 'Nenhum'}`,
    `• Seção mais impactada: ${secaoMais ? `${secaoMais.secao} (${secaoMais.count} folga${secaoMais.count>1?'s':''})` : 'Nenhuma'}`,
    `• Total de folgas regulares: ${folgas.length}`,
    `• Total de concessões: ${concessoes.length}`,
    `• Prontos sem solicitação: ${semFolga.length}`,
  ].forEach((item, i) => { doc.text(item, 16, y + 16 + i*6); });
  doc.setFillColor(...corStatusOp); doc.rect(pageW-70,y+6,55,14,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
  doc.text('SITUAÇÃO OPERACIONAL', pageW-42.5, y+11, { align:'center' });
  doc.setFontSize(12); doc.text(statusOp, pageW-42.5, y+18, { align:'center' });
  doc.setTextColor(120,130,140); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('32º BPM — Sistema Interno de Controle de Folgas', pageW/2, pageH-8, { align:'center' });
  doc.text('Página 1', pageW-12, pageH-8, { align:'right' });
  doc.addPage();
  doc.setFillColor(13,35,64); doc.rect(0,0,pageW,16,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('QUADRO OPERACIONAL DETALHADO', pageW/2, 10, { align:'center' });
  y = 22;
  if (aprovadas.length === 0) {
    doc.setTextColor(100,100,100); doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Nenhuma folga aprovada neste período.', pageW/2, y+10, { align:'center' });
  } else {
    DIAS.forEach(dia => {
      const dodia = aprovadas.filter(s => s.dia === dia);
      if (y > 250) { doc.addPage(); y = 20; }
      if (dodia.length === 0) {
        doc.setFillColor(230,235,240); doc.rect(10,y,pageW-20,10,'F');
        doc.setTextColor(100,110,120); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text(`${dia.toUpperCase()}-FEIRA`, 14, y+6.5);
        doc.setFont('helvetica','normal'); doc.text('Sem registros', pageW-14, y+6.5, { align:'right' });
        y += 13;
      } else {
        doc.setFillColor(30,77,123); doc.rect(10,y,pageW-20,10,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
        doc.text(`${dia.toUpperCase()}-FEIRA`, 14, y+6.5);
        doc.text(`${dodia.length} solicitação${dodia.length>1?'s':''}`, pageW-14, y+6.5, { align:'right' });
        y += 12;
        doc.autoTable({ startY:y, head:[['Seção','Policial','Tipo']], body:dodia.map(s=>[s.secao&&s.secao!=='—'?s.secao:'Não vinculada',`${s.patente} ${s.policial_nome}`,s.motivo]), theme:'grid', headStyles:{ fillColor:[50,100,150], textColor:255, fontStyle:'bold', fontSize:8 }, bodyStyles:{ fontSize:8 }, columnStyles:{ 0:{ cellWidth:35 }, 2:{ cellWidth:25, halign:'center' } }, alternateRowStyles:{ fillColor:[245,248,252] }, margin:{ left:10, right:10 } });
        y = doc.lastAutoTable.finalY + 6;
      }
    });
  }
  doc.setTextColor(120,130,140); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('32º BPM — Sistema Interno de Controle de Folgas', pageW/2, pageH-8, { align:'center' });
  doc.text('Página 2', pageW-12, pageH-8, { align:'right' });
  doc.addPage();
  doc.setFillColor(13,35,64); doc.rect(0,0,pageW,16,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text('ESTATÍSTICAS E MATRIZ DE DISTRIBUIÇÃO', pageW/2, 10, { align:'center' });
  y = 22;
  if (policiais && policiais.length > 0) {
    doc.setFillColor(50,100,150); doc.rect(10,y,pageW-20,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('SITUAÇÃO SANITÁRIA DO EFETIVO', 14, y+5.5); y += 10;
    const aptoAC = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto A'&&temRestricao(p)).length;
    const aptoAS = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto A'&&!temRestricao(p)).length;
    doc.autoTable({ startY:y, head:[['Situação Sanitária','Total']], body:[['Apto A (sem restrição)',String(aptoAS)],['Apto A (com restrição)',String(aptoAC)],...['Apto B','Apto C','LTS'].map(ss=>[ss,String(policiais.filter(p=>(p.sit_sanitaria||'Apto A')===ss).length)])], theme:'grid', headStyles:{ fillColor:[50,100,150], textColor:255, fontStyle:'bold', fontSize:8 }, bodyStyles:{ fontSize:8 }, alternateRowStyles:{ fillColor:[245,248,252] }, margin:{ left:10, right:10 } });
    y = doc.lastAutoTable.finalY + 6;
  }
  doc.setTextColor(120,130,140); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('32º BPM — Sistema Interno de Controle de Folgas', pageW/2, pageH-8, { align:'center' });
  doc.text('Página 3', pageW-12, pageH-8, { align:'right' });
  doc.save(`relatorio-32bpm-${periodoStr.replace(/\//g,'-').replace(/ /g,'')}.pdf`);
}

// ========== TELA DE SOLICITAÇÃO (Policial) ==========
function TelaSolicitacao({ usuario }) {
  const [dia, setDia] = useState(null);
  const [semana, setSemana] = useState('');
  const [motivo, setMotivo] = useState('');
  const [email, setEmail] = useState('');
  const [minhas, setMinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [solicitandoTroca, setSolicitandoTroca] = useState(null);
  const [novoDiaTroca, setNovoDiaTroca] = useState('');
  const [paginaMinhas, setPaginaMinhas] = useState(1);

  const carregarMinhas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('solicitacoes').select('*').eq('policial_id', usuario.id).order('created_at', { ascending:false });
    setMinhas(data || []);
    setLoading(false);
  }, [usuario.id]);

  useEffect(() => { carregarMinhas(); }, [carregarMinhas]);

  useEffect(() => {
    const interval = setInterval(() => { carregarMinhas(); }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [carregarMinhas]);

  const naoProto = usuario.situacao && usuario.situacao !== 'Pronto';

  async function enviar() {
    if (naoProto) return;
    if (!dia || !semana || !motivo) { setMsg({ tipo:'erro', texto:'Selecione o tipo, o dia e a data.' }); return; }
    if (!email || !validarEmail(email)) { setMsg({ tipo:'erro', texto:'Informe um email válido (ex: seu@email.com).' }); return; }

    const check = rateLimiterSolicitacao.podeExecutar();
    if (!check.permitido) {
      setMsg({ tipo:'erro', texto: `Aguarde ${check.proxemaEmMs}s antes de enviar nova solicitação.` });
      return;
    }

    const jaExiste = minhas.find(s => s.semana === semana && s.motivo === motivo && s.status !== 'recusado');
    if (jaExiste) { setMsg({ tipo:'erro', texto:`Você já possui uma ${motivo} solicitada para esta semana.` }); return; }

    setEnviando(true);
    const { error } = await supabase.from('solicitacoes').insert({
      policial_id: usuario.id,
      policial_nome: usuario.nome,
      matricula: usuario.matricula,
      patente: usuario.patente,
      secao: usuario.secao || '—',
      dia, semana, motivo,
      status: 'pendente',
      email_policial: email,
    });

    setEnviando(false);
    if (error) { setMsg({ tipo:'erro', texto:'Erro ao enviar.' }); return; }

    setDia(null); setSemana(''); setMotivo(''); setEmail('');
    setMsg({ tipo:'ok', texto:'✅ Solicitação enviada com sucesso!' });
    setTimeout(() => setMsg(null), 4000);
    carregarMinhas();
  }

  async function cancelarSolicitacao(id) {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    await supabase.from('solicitacoes').delete().eq('id', id);
    setMinhas(prev => prev.filter(s => s.id !== id));
  }

  async function enviarTroca(sol) {
    if (!novoDiaTroca) { setMsg({ tipo:'erro', texto:'Selecione o novo dia.' }); return; }
    if (novoDiaTroca === sol.dia) { setMsg({ tipo:'erro', texto:'O novo dia deve ser diferente do atual.' }); return; }
    await supabase.from('solicitacoes').update({ dia_troca:novoDiaTroca, status_troca:'pendente' }).eq('id', sol.id);
    setMinhas(prev => prev.map(s => s.id === sol.id ? { ...s, dia_troca:novoDiaTroca, status_troca:'pendente' } : s));
    setSolicitandoTroca(null); setNovoDiaTroca('');
    setMsg({ tipo:'ok', texto:'⏳ Solicitação de troca enviada! Aguarde aprovação.' });
    setTimeout(() => setMsg(null), 4000);
  }

  async function cancelarTroca(id) {
    await supabase.from('solicitacoes').update({ dia_troca:'', status_troca:'' }).eq('id', id);
    setMinhas(prev => prev.map(s => s.id === id ? { ...s, dia_troca:'', status_troca:'' } : s));
  }

  const paginado = paginar(minhas, paginaMinhas, POR_PAGINA);

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, color:'#1a3a5c', marginBottom:4 }}>Nova Solicitação</h2>
      <Card>
        <DetalhesPolicialCard policial={usuario} />

        {naoProto ? (
          <div style={{ background:'#FFEBEE', borderRadius:8, padding:'14px', textAlign:'center', color:'#B71C1C', fontWeight:700 }}>
            ⚠️ Você está classificado como <strong>{usuario.situacao}</strong> e não pode solicitar folga no momento.
          </div>
        ) : (
          <>
            <label style={lbl}>Tipo de solicitação *</label>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {MOTIVOS.map(m => <button key={m} onClick={() => setMotivo(m)} style={{ flex:1, padding:'14px 10px', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer', background:motivo===m?(m==='Folga'?'#0D47A1':'#6A1B9A'):'#f0f4f8', color:motivo===m?'#fff':'#2d4a63', border:motivo===m?`2px solid ${m==='Folga'?'#0D47A1':'#6A1B9A'}`:'2px solid transparent' }}>{m==='Folga'?'🌙 Folga':'🎖️ Concessão'}</button>)}
            </div>
            <label style={lbl}>Dia da semana *</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {DIAS.map(d => <button key={d} onClick={() => setDia(d)} style={{ padding:'7px 11px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', background:dia===d?'#1a3a5c':'#f0f4f8', color:dia===d?'#fff':'#2d4a63', border:dia===d?'2px solid #1a3a5c':'2px solid transparent' }}>{d}</button>)}
            </div>
            <label style={lbl}>Semana de referência *</label>
            <input type="date" value={semana} onChange={e => setSemana(e.target.value)} style={{ ...inp, marginBottom:14 }} />
            <label style={lbl}>Seu email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.email@gmail.com" style={{ ...inp, marginBottom:6 }} />
            {msg && <div style={{ padding:'10px 14px', borderRadius:8, marginTop:10, fontWeight:600, background:msg.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msg.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msg.texto}</div>}
            <button onClick={enviar} disabled={enviando} style={{ ...btnPrimary, opacity:enviando?0.7:1 }}>{enviando?'Enviando...':'Enviar Solicitação'}</button>
          </>
        )}
      </Card>

      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', margin:'22px 0 10px' }}>Minhas Solicitações</h3>
      {loading ? <Spinner /> : paginado.dados.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma solicitação registrada.</p>
        : (
          <>
            {paginado.dados.map(s => (
              <Card key={s.id}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <MotivoBadge motivo={s.motivo} />
                    <span style={{ fontWeight:800, color:'#1a3a5c' }}>{s.dia}</span>
                    <span style={{ color:'#6b8099', fontSize:13 }}>{s.semana}</span>
                  </div>
                  <Badge status={s.status} />
                </div>
                {s.status === 'aprovado' && s.status_troca === 'aprovado' && <div style={{ background:'#E8F5E9', borderRadius:8, padding:'6px 10px', marginTop:8, fontSize:12, color:'#1B5E20', fontWeight:700 }}>✅ Troca aprovada! Novo dia: <strong>{s.dia_troca}</strong></div>}
                {s.status === 'aprovado' && s.status_troca === 'pendente' && <div style={{ background:'#FFF8E1', borderRadius:8, padding:'6px 10px', marginTop:8, fontSize:12, color:'#7B5800', fontWeight:700, display:'flex', justifyContent:'space-between', alignItems:'center' }}><span>⏳ Troca para <strong>{s.dia_troca}</strong> aguardando aprovação</span><button onClick={() => cancelarTroca(s.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', fontSize:11 }}>Cancelar troca</button></div>}
                {s.status === 'aprovado' && s.status_troca === 'recusado' && <div style={{ background:'#FFEBEE', borderRadius:8, padding:'6px 10px', marginTop:8, fontSize:12, color:'#B71C1C', fontWeight:700 }}>❌ Troca para <strong>{s.dia_troca}</strong> foi recusada</div>}
                <p style={{ color:'#bbb', fontSize:12, marginTop:6 }}>Enviado em {formatarDataHora(s.created_at)}</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                  {s.status === 'pendente' && <button onClick={() => cancelarSolicitacao(s.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C' }}>✕ Cancelar</button>}
                  {s.status === 'aprovado' && !s.status_troca && <button onClick={() => { setSolicitandoTroca(s.id); setNovoDiaTroca(''); }} style={{ ...btnSm, background:'#E3F2FD', color:'#0D47A1' }}>🔄 Solicitar troca de dia</button>}
                </div>
                {solicitandoTroca === s.id && (
                  <div style={{ background:'#f0f6ff', borderRadius:8, padding:'12px', marginTop:10 }}>
                    <p style={{ fontWeight:700, color:'#1a3a5c', fontSize:13, marginBottom:8 }}>Escolha o novo dia:</p>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {DIAS.map(d => <button key={d} onClick={() => setNovoDiaTroca(d)} style={{ padding:'6px 10px', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer', background:novoDiaTroca===d?'#0D47A1':'#f0f4f8', color:novoDiaTroca===d?'#fff':'#2d4a63', border:novoDiaTroca===d?'2px solid #0D47A1':'2px solid transparent' }}>{d}</button>)}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => enviarTroca(s)} style={{ ...btnSm, background:'#0D47A1', color:'#fff' }}>Enviar pedido de troca</button>
                      <button onClick={() => { setSolicitandoTroca(null); setNovoDiaTroca(''); }} style={{ ...btnSm, background:'#f0f4f8', color:'#6b8099' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {paginado.totalPaginas > 1 && <ComponentePaginacao paginaAtual={paginaMinhas} totalPaginas={paginado.totalPaginas} onMudarPagina={setPaginaMinhas} />}
          </>
        )
      }
    </div>
  );
}

// ========== TELA DE GESTOR ==========
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
  const [filtroBuscaEfetivo, setFiltroBuscaEfetivo] = useState('todos');
  const [filtroEfSecao, setFiltroEfSecao] = useState('todas');
  const [filtroEfSit, setFiltroEfSit] = useState('todas');
  const [filtroEfSS, setFiltroEfSS] = useState('todas');
  const [filtroEfRest, setFiltroEfRest] = useState('todas');
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
  const [novoGestorFuncao, setNovoGestorFuncao] = useState('');
  const [novoGestorNivel, setNovoGestorNivel] = useState('gestor');
  const [msgGestor, setMsgGestor] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [paginaEfetivo, setPaginaEfetivo] = useState(1);
  const intervalRef = useRef(null);

  const carregar = useCallback(async () => {
    const [s, p, g] = await Promise.all([
      supabase.from('solicitacoes').select('*').order('created_at', { ascending:false }),
      supabase.from('policiais').select('*').order('nome'),
      supabase.from('gestores').select('*').order('created_at'),
    ]);
    setSolicitacoes(s.data || []);
    setPoliciais(p.data || []);
    setGestores(g.data || []);
    setUltimaAtualizacao(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    carregar();
    intervalRef.current = setInterval(() => { carregar(); }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [carregar]);

  function semanaAnterior() { const d = new Date(semanaAtual); d.setDate(d.getDate()-7); setSemanaAtual(d); }
  function proximaSemana() { const d = new Date(semanaAtual); d.setDate(d.getDate()+7); setSemanaAtual(d); }

  const fimSemana = new Date(semanaAtual);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const isoInicio = semanaAtual.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];
  const solicitacoesSemana = solicitacoes.filter(s => s.semana >= isoInicio && s.semana <= isoFim);
  const trocasPendentes = solicitacoes.filter(s => s.status_troca === 'pendente');
  const filtradas = solicitacoesSemana
    .filter(s => filtroStatus === 'todos' || s.status === filtroStatus)
    .filter(s => filtroSecao === 'todas' || s.secao === filtroSecao)
    .filter(s => filtroDia === 'todos' || s.dia === filtroDia)
    .filter(s => filtroMotivo === 'todos' || s.motivo === filtroMotivo);

  const semSecao = policiais.filter(p => !p.secao || p.secao === '');
  const retornosProximos = policiais.filter(p => p.situacao === 'Férias' && p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && diasParaRetorno(p.ferias_fim) <= 3 && diasParaRetorno(p.ferias_fim) >= 0);
  const prontos = policiais.filter(p => (p.situacao||'Pronto') === 'Pronto');
  const semFolgaSemana = prontos.filter(p => !solicitacoesSemana.find(s => s.policial_id === p.id && s.status !== 'recusado'));

  const policiaisfiltrados = policiais.filter(p => {
    const buscaOk = p.nome.toLowerCase().includes(busca.toLowerCase()) || p.matricula.includes(busca);
    const filtroOk = filtroBuscaEfetivo === 'todos' || (filtroBuscaEfetivo === 'sem_secao' && (!p.secao || p.secao === '')) || (filtroBuscaEfetivo === 'sem_folga' && semFolgaSemana.find(sf => sf.id === p.id));
    const secaoOk = filtroEfSecao === 'todas' || p.secao === filtroEfSecao;
    const sitOk = filtroEfSit === 'todas' || (p.situacao||'Pronto') === filtroEfSit;
    const ssOk = filtroEfSS === 'todas' || (p.sit_sanitaria||'Apto A') === filtroEfSS;
    const restOk = filtroEfRest === 'todas' || (p.restricao||'Sem restrição') === filtroEfRest;
    return buscaOk && filtroOk && secaoOk && sitOk && ssOk && restOk;
  });

  const paginadasSolic = paginar(filtradas, paginaSolicitacoes, POR_PAGINA);
  const paginadasEfetivo = paginar(policiaisfiltrados, paginaEfetivo, POR_PAGINA);

  const stats = {
    total: solicitacoesSemana.length,
    pendentes: solicitacoesSemana.filter(s => s.status === 'pendente').length,
    aprovadas: solicitacoesSemana.filter(s => s.status === 'aprovado').length,
    recusadas: solicitacoesSemana.filter(s => s.status === 'recusado').length,
  };

  const isPrincipal = gestorLogado.principal === true;
  const isMaster = isPrincipal || gestorLogado.nivel === 'master';

  async function mudarStatus(id, status) {
    if (!isMaster) return;

    const check = rateLimiterAprovacao.podeExecutar();
    if (!check.permitido) {
      alert(`Aguarde ${check.proxemaEmMs}s antes de fazer nova aprovação`);
      return;
    }

    await supabase.from('solicitacoes').update({ status }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));

    const sol = solicitacoes.find(s => s.id === id);
    if (sol && sol.email_policial && status !== 'pendente') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        email:sol.email_policial,
        nome:sol.policial_nome,
        motivo:sol.motivo,
        dia:sol.dia,
        semana:sol.semana,
        status:status==='aprovado'?'✅ APROVADA':'❌ RECUSADA',
        secao:sol.secao,
        matricula:sol.matricula
      });
    }

    // Registrar no histórico
    registrarHistorico(supabase, 'solicitacoes', 'mudança_status', { id, status }, gestorLogado.id, gestorLogado.nome);
  }

  async function aprovarTroca(sol) {
    if (!isMaster) return;
    await supabase.from('solicitacoes').update({ dia:sol.dia_troca, status_troca:'aprovado' }).eq('id', sol.id);
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, dia:sol.dia_troca, status_troca:'aprovado' } : s));
  }

  async function recusarTroca(id) {
    if (!isMaster) return;
    await supabase.from('solicitacoes').update({ status_troca:'recusado' }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status_troca:'recusado' } : s));
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

  async function removerPolicial(id) {
    if (!window.confirm('Confirmar remoção?')) return;
    await supabase.from('solicitacoes').delete().eq('policial_id', id);
    await supabase.from('policiais').delete().eq('id', id);
    setPoliciais(prev => prev.filter(p => p.id !== id));
    setSolicitacoes(prev => prev.filter(s => s.policial_id !== id));
  }

  async function adicionarPolicial() {
    if (!novoNome.trim() || !validarMatricula(novaMatricula) || !novaSecao) {
      alert('Preencha todos os campos corretamente');
      return;
    }

    const { data, error } = await supabase.from('policiais').insert({
      nome: novoNome.toUpperCase(),
      matricula: novaMatricula,
      patente: novaPatente,
      secao: novaSecao,
      senha: '',
      sit_sanitaria: 'Apto A',
      situacao: 'Pronto',
      restricao: 'Sem restrição'
    }).select().single();

    if (!error && data) setPoliciais(prev => [...prev, data].sort((a,b) => a.nome.localeCompare(b.nome)));
    setNovoNome(''); setNovaMatricula(''); setNovaPatente('3º SGT PM'); setNovaSecao('');
  }

  async function alterarMinhaSenha() {
    const mim = gestores.find(g => g.id === gestorLogado.id);
    if (!mim || mim.senha !== senhaAtual) { setMsgSenha({ tipo:'erro', texto:'Senha atual incorreta.' }); return; }
    if (!validarSenha(novaSenha)) { setMsgSenha({ tipo:'erro', texto:'Mínimo 4 caracteres.' }); return; }
    if (novaSenha !== confirmaSenha) { setMsgSenha({ tipo:'erro', texto:'Senhas não coincidem.' }); return; }
    await supabase.from('gestores').update({ senha:novaSenha }).eq('id', gestorLogado.id);
    setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('');
    setMsgSenha({ tipo:'ok', texto:'Senha alterada!' });
    setTimeout(() => setMsgSenha(null), 3000);
  }

  async function adicionarGestor() {
    if (!novoGestorNome.trim() || !validarMatricula(novoGestorMatricula) || !validarSenha(novoGestorSenha)) {
      setMsgGestor({ tipo:'erro', texto:'Preencha todos os campos corretamente.' });
      return;
    }
    if (gestores.find(g => g.matricula === novoGestorMatricula)) {
      setMsgGestor({ tipo:'erro', texto:'Matrícula já cadastrada.' });
      return;
    }

    const { data, error } = await supabase.from('gestores').insert({
      nome: novoGestorNome.toUpperCase(),
      matricula: novoGestorMatricula,
      senha: novoGestorSenha,
      principal: false,
      nivel: novoGestorNivel,
      funcao: novoGestorFuncao
    }).select().single();

    if (error) { setMsgGestor({ tipo:'erro', texto:'Erro ao cadastrar.' }); return; }
    setGestores(prev => [...prev, data]);
    setNovoGestorNome(''); setNovoGestorMatricula(''); setNovoGestorSenha(''); setNovoGestorFuncao(''); setNovoGestorNivel('gestor');
    setMsgGestor({ tipo:'ok', texto:'Gestor cadastrado!' });
    setTimeout(() => setMsgGestor(null), 3000);
  }

  async function alterarNivelGestor(id, nivel) {
    await supabase.from('gestores').update({ nivel }).eq('id', id);
    setGestores(prev => prev.map(g => g.id === id ? { ...g, nivel } : g));
  }

  async function alterarFuncaoGestor(id, funcao) {
    await supabase.from('gestores').update({ funcao }).eq('id', id);
    setGestores(prev => prev.map(g => g.id === id ? { ...g, funcao } : g));
  }

  async function removerGestor(id) {
    if (!window.confirm('Remover este gestor?')) return;
    await supabase.from('gestores').delete().eq('id', id);
    setGestores(prev => prev.filter(g => g.id !== id));
  }

  const ABAS = [
    { id:'solicitacoes', label:'📋 Solicitações' },
    { id:'trocas', label:`🔄 Trocas${trocasPendentes.length > 0 ? ` (${trocasPendentes.length})` : ''}` },
    { id:'calendario', label:'📅 Calendário' },
    { id:'efetivo', label:'👮 Efetivo' },
    { id:'gestores', label:'🗝️ Gestores' },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      {retornosProximos.length > 0 && (
        <div style={{ background:'#FFF3E0', border:'2px solid #FFB74D', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#E65100', fontSize:13, marginBottom:8 }}>⏰ Férias encerrando em até 3 dias:</div>
          {retornosProximos.map(p => { const dias = diasParaRetorno(p.ferias_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#B71C1C':dias<=1?'#E65100':'#F9A825', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Retorna hoje!':dias===1?'Retorna amanhã!':`${dias} dias`}</span></div>); })}
        </div>
      )}

      {!isMaster && (
        <div style={{ background:'#E3F2FD', border:'2px solid #90CAF9', borderRadius:10, padding:'10px 16px', marginBottom:14, fontSize:13, color:'#0D47A1', fontWeight:700 }}>
          👁️ Você está no modo visualização. Apenas gestores Master ou Principal podem aprovar ou recusar solicitações.
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
        <span style={{ fontSize:11, color:'#aab' }}>🔄 Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[{l:'Total',v:stats.total,c:'#1a3a5c'},{l:'Pendentes',v:stats.pendentes,c:'#7B5800'},{l:'Aprovadas',v:stats.aprovadas,c:'#1B5E20'},{l:'Recusadas',v:stats.recusadas,c:'#B71C1C'}]
          .map(s => <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'12px 8px', boxShadow:'0 2px 8px #00000012', textAlign:'center' }}><div style={{ fontSize:24, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {ABAS.map(a => <button key={a.id} onClick={() => setAba(a.id)} style={{ padding:'8px 14px', borderRadius:8, fontWeight:700, cursor:'pointer', background:aba===a.id?'#1a3a5c':'#f0f4f8', color:aba===a.id?'#fff':'#2d4a63', border:'none', fontSize:12 }}>{a.label}</button>)}
      </div>

      {aba === 'solicitacoes' && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', borderRadius:10, padding:'10px 16px', marginBottom:14, boxShadow:'0 2px 8px #00000012' }}>
            <button onClick={semanaAnterior} style={{ ...btnSm, background:'#f0f4f8', color:'#1a3a5c' }}>← Anterior</button>
            <span style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>📅 {formatarSemana(semanaAtual)}</span>
            <button onClick={proximaSemana} style={{ ...btnSm, background:'#f0f4f8', color:'#1a3a5c' }}>Próxima →</button>
          </div>

          <button onClick={() => gerarPDF(solicitacoesSemana, policiais, semanaAtual)} style={{ ...btnPrimary, marginTop:0, marginBottom:14, background:'#1B5E20' }}>📄 Gerar Relatório PDF</button>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginBottom:14 }}>
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

          {paginadasSolic.dados.length === 0
            ? <p style={{ color:'#aab', fontSize:13, textAlign:'center', padding:20 }}>Nenhuma solicitação nesta semana.</p>
            : (
              <>
                {paginadasSolic.dados.map(s => {
                  const policial = policiais.find(p => p.id === s.policial_id);
                  return (
                    <Card key={s.id}>
                      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                        <div><span style={{ fontWeight:800, color:'#1a3a5c', fontSize:14 }}>{s.patente} {s.policial_nome}</span><span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>Mat. {s.matricula}</span></div>
                        <Badge status={s.status} />
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                        <MotivoBadge motivo={s.motivo} />
                        <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{s.secao&&s.secao!=='—'?s.secao:'Não vinculada'}</span>
                        <span style={{ color:'#2d4a63', fontSize:13 }}>📅 <strong>{s.dia}</strong> — {s.semana}</span>
                      </div>

                      {/* NOVO: Detalhes do Policial na Confirmação */}
                      {policial && (
                        <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginTop:10, fontSize:12, display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
                          <div><span style={{ color:'#6b8099', fontWeight:700 }}>🏥 Sit. Sanitária:</span><div style={{ color:COR_SS[policial.sit_sanitaria || 'Apto A'], fontWeight:800, marginTop:2 }}>{EMOJI_SS[policial.sit_sanitaria || 'Apto A']} {policial.sit_sanitaria || 'Apto A'}</div></div>
                          <div><span style={{ color:'#6b8099', fontWeight:700 }}>📋 Situação:</span><div style={{ color:(policial.situacao||'Pronto')==='Pronto'?'#1B5E20':'#B71C1C', fontWeight:800, marginTop:2 }}>{policial.situacao||'Pronto'}</div></div>
                          <div><span style={{ color:'#6b8099', fontWeight:700 }}>⚠️ Restrição:</span><div style={{ color:(policial.restricao||'Sem restrição')==='Sem restrição'?'#1B5E20':'#E65100', fontWeight:800, marginTop:2 }}>{policial.restricao||'Sem restrição'}</div></div>
                          <div><span style={{ color:'#6b8099', fontWeight:700 }}>📍 Seção:</span><div style={{ color:'#1a3a5c', fontWeight:800, marginTop:2 }}>{policial.secao||'—'}</div></div>
                        </div>
                      )}

                      {s.status_troca === 'pendente' && <div style={{ background:'#FFF8E1', borderRadius:6, padding:'4px 10px', marginTop:6, fontSize:12, color:'#7B5800', fontWeight:700 }}>⏳ Troca pendente para: <strong>{s.dia_troca}</strong></div>}
                      {s.status_troca === 'aprovado' && <div style={{ background:'#E8F5E9', borderRadius:6, padding:'4px 10px', marginTop:6, fontSize:12, color:'#1B5E20', fontWeight:700 }}>✅ Troca aprovada para: <strong>{s.dia_troca}</strong></div>}
                      {s.email_policial && <p style={{ color:'#aab', fontSize:12, marginTop:4 }}>📧 {s.email_policial}</p>}
                      <p style={{ color:'#bbb', fontSize:12, marginTop:4 }}>{formatarDataHora(s.created_at)}</p>

                      {isMaster && s.status === 'pendente' && (
                        <div style={{ display:'flex', gap:8, marginTop:10 }}>
                          <button onClick={() => mudarStatus(s.id,'aprovado')} style={{ ...btnSm, background:'#1B5E20', color:'#fff' }}>✔ Aprovar</button>
                          <button onClick={() => mudarStatus(s.id,'recusado')} style={{ ...btnSm, background:'#B71C1C', color:'#fff' }}>✘ Recusar</button>
                        </div>
                      )}
                      {isMaster && s.status === 'recusado' && <button onClick={() => excluirSolicitacao(s.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', marginTop:8 }}>🗑️ Excluir</button>}
                      {isMaster && s.status === 'aprovado' && <button onClick={() => mudarStatus(s.id,'pendente')} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800', marginTop:8 }}>↩️ Revogar aprovação</button>}
                    </Card>
                  );
                })}
                {paginadasSolic.totalPaginas > 1 && <ComponentePaginacao paginaAtual={paginaSolicitacoes} totalPaginas={paginadasSolic.totalPaginas} onMudarPagina={setPaginaSolicitacoes} />}
              </>
            )
          }

          <div style={{ display:'flex', gap:8, marginTop:20 }}>
            <button onClick={() => exportarParaCSV(solicitacoesSemana, 'solicitacoes')} style={{ ...btnSm, background:'#0D47A1', color:'#fff', flex:1 }}>📊 Exportar CSV</button>
            <button onClick={() => exportarParaExcel(solicitacoesSemana, 'solicitacoes', 'Folgas')} style={{ ...btnSm, background:'#1B5E20', color:'#fff', flex:1 }}>📈 Exportar Excel</button>
          </div>
        </>
      )}

      {aba === 'trocas' && (
        <>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:16 }}>🔄 Solicitações de Troca de Dia</h3>
          {trocasPendentes.length === 0
            ? <p style={{ color:'#aab', fontSize:13, textAlign:'center', padding:20 }}>Nenhuma solicitação de troca pendente.</p>
            : trocasPendentes.map(s => (
              <Card key={s.id} style={{ border:'2px solid #FFD54F' }}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div><span style={{ fontWeight:800, color:'#1a3a5c', fontSize:14 }}>{s.patente} {s.policial_nome}</span><span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>Mat. {s.matricula}</span></div>
                  <span style={{ background:'#FFF8E1', color:'#7B5800', border:'1px solid #FFD54F', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>TROCA PENDENTE</span>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                  <MotivoBadge motivo={s.motivo} />
                  <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{s.secao}</span>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:10, background:'#f8fafc', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:'#6b8099', fontWeight:700, marginBottom:4 }}>DIA ATUAL</div><div style={{ fontWeight:900, color:'#B71C1C', fontSize:16 }}>{s.dia}</div></div>
                  <div style={{ fontSize:20 }}>→</div>
                  <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:'#6b8099', fontWeight:700, marginBottom:4 }}>NOVO DIA</div><div style={{ fontWeight:900, color:'#1B5E20', fontSize:16 }}>{s.dia_troca}</div></div>
                  <div style={{ fontSize:10, color:'#6b8099', marginLeft:'auto' }}>Semana: {s.semana}</div>
                </div>
                {isMaster && (
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <button onClick={() => aprovarTroca(s)} style={{ ...btnSm, background:'#1B5E20', color:'#fff' }}>✔ Aprovar troca</button>
                    <button onClick={() => recusarTroca(s.id)} style={{ ...btnSm, background:'#B71C1C', color:'#fff' }}>✘ Recusar troca</button>
                  </div>
                )}
              </Card>
            ))
          }
          <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', margin:'20px 0 10px' }}>Histórico de Trocas</h3>
          {solicitacoes.filter(s => s.status_troca && s.status_troca !== 'pendente' && s.status_troca !== '').length === 0
            ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma troca processada ainda.</p>
            : solicitacoes.filter(s => s.status_troca && s.status_troca !== 'pendente' && s.status_troca !== '').map(s => (
              <Card key={s.id} style={{ opacity:0.8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <div><span style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>{s.patente} {s.policial_nome}</span><div style={{ fontSize:12, color:'#6b8099', marginTop:2 }}>{s.dia_troca ? `${s.dia} → ${s.dia_troca}` : ''} · {s.semana}</div></div>
                  <span style={{ background:s.status_troca==='aprovado'?'#E8F5E9':'#FFEBEE', color:s.status_troca==='aprovado'?'#1B5E20':'#B71C1C', border:`1px solid ${s.status_troca==='aprovado'?'#A5D6A7':'#EF9A9A'}`, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800 }}>{s.status_troca==='aprovado'?'APROVADA':'RECUSADA'}</span>
                </div>
              </Card>
            ))
          }
        </>
      )}

      {aba === 'calendario' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>📅 Calendário de Folgas Aprovadas</h3>
          {/* Calendário completo aqui */}
          <p style={{ color:'#aab' }}>Calendário renderizado...</p>
        </Card>
      )}

      {aba === 'efetivo' && (
        <>
          {semSecao.length > 0 && (
            <div style={{ background:'#FFEBEE', border:'2px solid #EF9A9A', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
              <div style={{ fontWeight:800, color:'#B71C1C', fontSize:13, marginBottom:6 }}>⚠️ {semSecao.length} policial(is) sem seção definida</div>
              <button onClick={() => setFiltroBuscaEfetivo(filtroBuscaEfetivo==='sem_secao'?'todos':'sem_secao')} style={{ ...btnSm, background:'#B71C1C', color:'#fff', marginRight:8 }}>{filtroBuscaEfetivo==='sem_secao'?'Ver todos':'Ver só sem seção'}</button>
            </div>
          )}

          {semFolgaSemana.length > 0 && (
            <div style={{ background:'#E3F2FD', border:'2px solid #90CAF9', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
              <div style={{ fontWeight:800, color:'#0D47A1', fontSize:13, marginBottom:6 }}>📋 {semFolgaSemana.length} policial(is) Pronto(s) sem solicitação esta semana</div>
              <button onClick={() => setFiltroBuscaEfetivo(filtroBuscaEfetivo==='sem_folga'?'todos':'sem_folga')} style={{ ...btnSm, background:'#0D47A1', color:'#fff' }}>{filtroBuscaEfetivo==='sem_folga'?'Ver todos':'Ver só sem folga'}</button>
            </div>
          )}

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

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <select value={filtroEfSecao} onChange={e => setFiltroEfSecao(e.target.value)} style={inp}>
              <option value="todas">Todas as seções</option>
              {SECOES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtroEfSit} onChange={e => setFiltroEfSit(e.target.value)} style={inp}>
              <option value="todas">Todas as situações</option>
              {SITUACOES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtroEfSS} onChange={e => setFiltroEfSS(e.target.value)} style={inp}>
              <option value="todas">Toda sit. sanitária</option>
              {SIT_SANITARIA_LTS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtroEfRest} onChange={e => setFiltroEfRest(e.target.value)} style={inp}>
              <option value="todas">Todas as restrições</option>
              {RESTRICOES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <p style={{ color:'#6b8099', fontSize:12, marginBottom:10 }}>{paginadasEfetivo.total} policial(is)</p>

          {paginadasEfetivo.dados.map(p => (
            <Card key={p.id} style={{ padding:'12px 16px', border:(!p.secao||p.secao==='')?'2px solid #EF9A9A':'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>{p.patente} {p.nome}</div>
                  <div style={{ color:'#6b8099', fontSize:12, marginTop:2 }}>Mat. {p.matricula}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                    <div><label style={{ ...lbl, fontSize:10 }}>Seção</label><select value={p.secao||''} onChange={e => atualizarPolicial(p.id,'secao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}><option value="">— Não definida —</option>{SECOES.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Sit. Sanitária</label><select value={p.sit_sanitaria||'Apto A'} onChange={e => atualizarPolicial(p.id,'sit_sanitaria',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{SIT_SANITARIA_LTS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Situação</label><select value={p.situacao||'Pronto'} onChange={e => atualizarPolicial(p.id,'situacao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{SITUACOES.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label style={{ ...lbl, fontSize:10 }}>Restrições</label><select value={p.restricao||'Sem restrição'} onChange={e => atualizarPolicial(p.id,'restricao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{RESTRICOES.map(s => <option key={s}>{s}</option>)}</select></div>
                  </div>
                  {p.situacao === 'Férias' && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8, background:'#FFF8E1', borderRadius:8, padding:'10px' }}>
                      <div><label style={{ ...lbl, fontSize:10 }}>Início das Férias</label><input type="date" value={p.ferias_inicio||''} onChange={e => atualizarPolicial(p.id,'ferias_inicio',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      <div><label style={{ ...lbl, fontSize:10 }}>Fim das Férias</label><input type="date" value={p.ferias_fim||''} onChange={e => atualizarPolicial(p.id,'ferias_fim',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      {p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && (<div style={{ gridColumn:'1/-1' }}><span style={{ background:diasParaRetorno(p.ferias_fim)<=3?'#B71C1C':'#1B5E20', color:'#fff', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>{diasParaRetorno(p.ferias_fim)===0?'Retorna hoje!':diasParaRetorno(p.ferias_fim)<0?'Férias vencidas!':diasParaRetorno(p.ferias_fim)<=3?`⚠️ Retorna em ${diasParaRetorno(p.ferias_fim)} dias`:`Retorna em ${diasParaRetorno(p.ferias_fim)} dias`}</span></div>)}
                    </div>
                  )}
                  {p.sit_sanitaria === 'LTS' && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8, background:'#F3E5F5', borderRadius:8, padding:'10px' }}>
                      <div><label style={{ ...lbl, fontSize:10 }}>Início do LTS</label><input type="date" value={p.ferias_inicio||''} onChange={e => atualizarPolicial(p.id,'ferias_inicio',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      <div><label style={{ ...lbl, fontSize:10 }}>Fim do LTS</label><input type="date" value={p.ferias_fim||''} onChange={e => atualizarPolicial(p.id,'ferias_fim',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      {p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && (<div style={{ gridColumn:'1/-1' }}><span style={{ background:diasParaRetorno(p.ferias_fim)<=3?'#6A1B9A':'#1B5E20', color:'#fff', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>{diasParaRetorno(p.ferias_fim)===0?'Retorna hoje!':diasParaRetorno(p.ferias_fim)<0?'LTS vencido!':diasParaRetorno(p.ferias_fim)<=3?`⚠️ Retorna em ${diasParaRetorno(p.ferias_fim)} dias`:`Retorna em ${diasParaRetorno(p.ferias_fim)} dias`}</span></div>)}
                    </div>
                  )}
                  <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <SSBadge p={p} /><SituacaoBadge situacao={p.situacao||'Pronto'} />
                    {p.restricao && p.restricao !== 'Sem restrição' && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{p.restricao}</span>}
                    <button onClick={() => resetarSenhaPolicial(p.id, p.nome)} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800' }}>🔑 Resetar senha</button>
                  </div>
                </div>
                <button onClick={() => removerPolicial(p.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C', marginTop:4 }}>Remover</button>
              </div>
            </Card>
          ))}

          {paginadasEfetivo.totalPaginas > 1 && <ComponentePaginacao paginaAtual={paginaEfetivo} totalPaginas={paginadasEfetivo.totalPaginas} onMudarPagina={setPaginaEfetivo} />}

          <div style={{ display:'flex', gap:8, marginTop:20 }}>
            <button onClick={() => exportarParaCSV(policiais, 'efetivo')} style={{ ...btnSm, background:'#0D47A1', color:'#fff', flex:1 }}>📊 Exportar CSV</button>
            <button onClick={() => exportarParaExcel(policiais, 'efetivo', 'Efetivo')} style={{ ...btnSm, background:'#1B5E20', color:'#fff', flex:1 }}>📈 Exportar Excel</button>
          </div>
        </>
      )}

      {aba === 'gestores' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:4 }}>🔒 Alterar Minha Senha</h3>
            <p style={{ color:'#6b8099', fontSize:13, marginBottom:14 }}>
              Conectado como: <strong>{gestorLogado.nome}</strong>
              {' '}<span style={{ background:nivelLabel(gestorLogado).bg, color:nivelLabel(gestorLogado).color, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{nivelLabel(gestorLogado).label}</span>
              {gestorLogado.funcao && <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, marginLeft:4 }}>{gestorLogado.funcao}</span>}
            </p>
            <label style={lbl}>Senha atual</label>
            <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="••••" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Nova senha</label>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:10 }} />
            <label style={lbl}>Confirmar nova senha</label>
            <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} placeholder="Repita a nova senha" style={{ ...inp, marginBottom:6 }} />
            {msgSenha && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgSenha.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgSenha.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgSenha.texto}</div>}
            <button onClick={alterarMinhaSenha} style={btnPrimary}>Salvar Nova Senha</button>
          </Card>

          {isPrincipal && (
            <Card>
              <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:4 }}>➕ Cadastrar Novo Gestor</h3>
              <label style={lbl}>Nome / Patente *</label>
              <input value={novoGestorNome} onChange={e => setNovoGestorNome(e.target.value)} placeholder="Ex.: TEN CEL SILVA" style={{ ...inp, marginBottom:10 }} />
              <label style={lbl}>Matrícula *</label>
              <input value={novoGestorMatricula} onChange={e => setNovoGestorMatricula(e.target.value)} placeholder="Ex.: 80231" style={{ ...inp, marginBottom:10 }} />
              <label style={lbl}>Senha de acesso *</label>
              <input type="password" value={novoGestorSenha} onChange={e => setNovoGestorSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:10 }} />
              <label style={lbl}>Função</label>
              <select value={novoGestorFuncao} onChange={e => setNovoGestorFuncao(e.target.value)} style={{ ...inp, marginBottom:10 }}>
                {FUNCOES_GESTOR.map(f => <option key={f} value={f}>{f || '— Sem função específica —'}</option>)}
              </select>
              <label style={lbl}>Nível de acesso</label>
              <select value={novoGestorNivel} onChange={e => setNovoGestorNivel(e.target.value)} style={{ ...inp, marginBottom:6 }}>
                <option value="gestor">Gestor (apenas visualização)</option>
                <option value="master">Master (pode aprovar/recusar)</option>
              </select>
              {msgGestor && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgGestor.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgGestor.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgGestor.texto}</div>}
              <button onClick={adicionarGestor} style={btnPrimary}>Cadastrar Gestor</button>
            </Card>
          )}

          <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', margin:'20px 0 10px' }}>Gestores Cadastrados</h3>
          {gestores.map(g => {
            const nl = nivelLabel(g);
            return (
              <Card key={g.id} style={{ padding:'12px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontWeight:800, color:'#1a3a5c' }}>{g.nome}</span>
                      <span style={{ color:'#6b8099', fontSize:12 }}>Mat. {g.matricula}</span>
                      <span style={{ background:nl.bg, color:nl.color, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{nl.label}</span>
                      {g.funcao && <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{g.funcao}</span>}
                    </div>
                    {isPrincipal && !g.principal && (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                        <select value={g.nivel||'gestor'} onChange={e => alterarNivelGestor(g.id, e.target.value)} style={{ ...inp, fontSize:12, padding:'5px 8px', width:'auto' }}>
                          <option value="gestor">Gestor</option>
                          <option value="master">Master</option>
                        </select>
                        <select value={g.funcao||''} onChange={e => alterarFuncaoGestor(g.id, e.target.value)} style={{ ...inp, fontSize:12, padding:'5px 8px', width:'auto' }}>
                          {FUNCOES_GESTOR.map(f => <option key={f} value={f}>{f || '— Sem função —'}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {!g.principal && g.id !== gestorLogado.id && isPrincipal && <button onClick={() => removerGestor(g.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C' }}>Remover</button>}
                </div>
              </Card>
            );
          })}
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

  useEffect(() => {
    const sessao = carregarSessao();
    if (sessao) {
      if (sessao.tipo === 'policial') { setUsuarioSel(sessao.dados); setModo('policial'); }
      else if (sessao.tipo === 'gestor') { setGestorLogado(sessao.dados); setModo('gestor'); }
    }
  }, []);

  async function loginGestor() {
    const { data } = await supabase.from('gestores').select('*').eq('senha', senhaGestor).single();
    if (data) { salvarSessao('gestor', data); setGestorLogado(data); setModo('gestor'); setErroSenha(false); }
    else setErroSenha(true);
  }

  function sair() { limparSessao(); setModo('login'); setUsuarioSel(null); setGestorLogado(null); setSenhaGestor(''); setErroSenha(false); }

  return (
    <div style={{ minHeight:'100vh', background:'#eef2f7', fontFamily:"'Segoe UI',Tahoma,sans-serif" }}>
      <div style={{ background:'linear-gradient(135deg,#0d2340 0%,#1a3a5c 60%,#1e4d7b 100%)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 20px #00000040' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:42, width:42, objectFit:'contain' }} />
          <div>
            <div style={{ color:'#fff', fontWeight:900, fontSize:17, letterSpacing:0.5 }}>32º BPM — Controle de Folgas</div>
            <div style={{ color:'#8db4d8', fontSize:11 }}>PCSV · Expediente Semanal · v2.0</div>
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
