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
  rateLimiterSolicitacao,
  rateLimiterAprovacao,
  registrarHistorico,
  exportarParaCSV,
  exportarParaExcel,
  formatarDataHora,
  CORES_STATUS,
  ComponentePaginacao,
  DetalhesPolicialCard,
} from './utils';
import AjdApp from './modules/ajd';

const EMAILJS_SERVICE_ID = 'service_97rq307';
const EMAILJS_TEMPLATE_ID = 'template_y0wm9hp';
const EMAILJS_PUBLIC_KEY = 'VmM8b5g2hP9fKqsm-';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta'];
const SECOES = ['P1','P3','P4','P5','Conferência','Tesouraria','Secretaria','Almoxarifado','SMT','SMB','Rancho','Ordenança','AJD','PCSV','Ed. Física','Técnica','Obra','Faxina','Gabinete Médico','Gabinete Odontológico'];
const MOTIVOS = ['Folga','Concessão'];
const SIT_SANITARIA_LTS = ['Apto A','Apto B','Apto C','LTS'];
const SITUACOES = ['Pronto','Férias','LE','LTSPF','LTS','LP','Núpcias','Luto'];
const RESTRICOES = ['Sem restrição','SP','CD','CRD','CHR'];
const FUNCOES_GESTOR = ['','Comandante','SubComandante','Comandante de Cia','Chefe da P1','Brigada','Sargenteante'];
const PATENTES = ['TEN CEL PM','MAJ PM','CAP PM','1º TEN PM','2º TEN PM','SUB TEN PM','1º SGT PM','2º SGT PM','3º SGT PM','CB PM','SD PM'];

const COR_SS = { 'Apto A':'#1565C0', 'Apto B':'#F9A825', 'Apto C':'#B71C1C', 'LTS':'#6A1B9A' };
const EMOJI_SS = { 'Apto A':'🔵', 'Apto B':'🟡', 'Apto C':'🔴', 'LTS':'🟣' };
const CORES_GRAFICO = ['#1a3a5c','#2E7D32','#6A1B9A','#0D47A1','#B71C1C','#E65100','#00695C','#4A148C','#880E4F','#1B5E20','#F57F17','#37474F','#1565C0','#283593','#4E342E','#33691E','#006064','#01579B'];

const AUTO_REFRESH_INTERVAL = 120000; // 2 minutos
const POR_PAGINA = 15;

// ========== CONTADOR DE FOLGAS ==========
function contarFolgas(solicitacoes, policialId) {
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();
  const aprovadas = solicitacoes.filter(s => s.policial_id === policialId && s.status === 'aprovado');
  const folgas = aprovadas.filter(s => s.motivo === 'Folga');
  const concessoes = aprovadas.filter(s => s.motivo === 'Concessão');
  const folgasAno = folgas.filter(s => s.semana && new Date(s.semana).getFullYear() === anoAtual);
  const folgasMes = folgas.filter(s => {
    if (!s.semana) return false;
    const d = new Date(s.semana);
    return d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
  });
  const concessoesAno = concessoes.filter(s => s.semana && new Date(s.semana).getFullYear() === anoAtual);
  return { folgasAno: folgasAno.length, folgasMes: folgasMes.length, concessoesAno: concessoesAno.length };
}

function ContadorFolgas({ solicitacoes, policialId, compact = false }) {
  const { folgasAno, folgasMes, concessoesAno } = contarFolgas(solicitacoes, policialId);
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  if (compact) {
    return (
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
        <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>🌙 {folgasMes} folga{folgasMes !== 1 ? 's' : ''} este mês</span>
        <span style={{ background:'#EDE7F6', color:'#4527A0', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>📅 {folgasAno} no ano</span>
        {concessoesAno > 0 && <span style={{ background:'#F3E5F5', color:'#6A1B9A', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>🎖️ {concessoesAno} concessão{concessoesAno !== 1 ? 'ões' : ''} no ano</span>}
      </div>
    );
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:8, margin:'12px 0' }}>
      <div style={{ background:'#E3F2FD', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#0D47A1' }}>{folgasMes}</div>
        <div style={{ fontSize:10, color:'#1565C0', fontWeight:700 }}>🌙 Folgas em {mesNome}</div>
      </div>
      <div style={{ background:'#EDE7F6', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#4527A0' }}>{folgasAno}</div>
        <div style={{ fontSize:10, color:'#4527A0', fontWeight:700 }}>📅 Folgas no ano</div>
      </div>
      <div style={{ background:'#F3E5F5', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#6A1B9A' }}>{concessoesAno}</div>
        <div style={{ fontSize:10, color:'#6A1B9A', fontWeight:700 }}>🎖️ Concessões no ano</div>
      </div>
    </div>
  );
}

const inp = { width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, color:'#0f172a', background:'#fff', boxSizing:'border-box', outline:'none', transition:'border-color 0.2s, background 0.2s' };
const lbl = { display:'block', fontSize:10, fontWeight:800, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:1.5 };
const btnPrimary = { display:'block', width:'100%', padding:'13px', background:'#1a3a5c', color:'#fff', border:'none', borderRadius:8, fontWeight:800, fontSize:13, cursor:'pointer', marginTop:12, letterSpacing:'0.12em', textTransform:'uppercase' };
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
// Auth agora é gerenciada pelo Supabase Auth (createClient com persistSession:true).
// salvarSessao/carregarSessao/limparSessao foram removidos — a sessão vive no
// localStorage do supabase-js sob a chave sb-<projectref>-auth-token, e o
// onAuthStateChange no App() faz o roteamento.

function Card({ children, style }) {
  return <div className="card-light" style={{ background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 12px #00000012', marginBottom:10, ...style }}>{children}</div>;
}

/**
 * Edição inline genérica: mostra um valor e um ícone de lápis.
 * Ao clicar no lápis, vira input/select com botões ✓ e ✕.
 *
 * Props:
 *   valor:    valor atual exibido
 *   onSalvar: async (novoValor) => bool. Retornar true se salvou OK, false se inválido.
 *   tipo:     'text' (default) ou 'select'
 *   opcoes:   array de strings (se tipo='select')
 *   validar:  fn opcional (valor) => string|null (msg de erro)
 *   placeholder, style, inputStyle: passados pro elemento
 */
function EditavelInline({ valor, onSalvar, tipo = 'text', opcoes = [], validar, placeholder, style = {}, inputStyle = {} }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Sincroniza quando o valor externo muda (ex.: reload do supabase)
  useEffect(() => { if (!editando) setV(valor); }, [valor, editando]);

  async function salvar() {
    if (validar) {
      const msg = validar(v);
      if (msg) { setErro(msg); return; }
    }
    if (v === valor) { setEditando(false); setErro(null); return; }
    setSalvando(true);
    const ok = await onSalvar(v);
    setSalvando(false);
    if (ok) { setEditando(false); setErro(null); }
    else setErro('Erro ao salvar');
  }

  function cancelar() { setV(valor); setEditando(false); setErro(null); }

  if (!editando) {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:6, ...style }}>
        <span>{valor || <em style={{ color:'#aab' }}>—</em>}</span>
        <button
          onClick={() => setEditando(true)}
          title="Editar"
          style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px 4px', borderRadius:4, color:'#6b8099', fontSize:12, lineHeight:1 }}
          onMouseEnter={e => e.currentTarget.style.background='#f0f4f8'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
        >✏️</button>
      </span>
    );
  }

  const inputBase = { padding:'4px 8px', borderRadius:6, border:'1.5px solid #1a3a5c', background:'#fff', color:'#0f172a', fontSize:'inherit', fontWeight:'inherit', minWidth:0, ...inputStyle };

  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, flexWrap:'wrap', ...style }}>
      {tipo === 'select' ? (
        <select value={v} onChange={e => setV(e.target.value)} autoFocus style={inputBase}>
          {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type="text"
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') salvar(); if (e.key==='Escape') cancelar(); }}
          placeholder={placeholder}
          autoFocus
          style={inputBase}
        />
      )}
      <button onClick={salvar} disabled={salvando} title="Salvar" style={{ background:'#1B5E20', color:'#fff', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:800, opacity:salvando?0.6:1 }}>✓</button>
      <button onClick={cancelar} disabled={salvando} title="Cancelar" style={{ background:'#FFEBEE', color:'#B71C1C', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:800 }}>✕</button>
      {erro && <span style={{ color:'#B71C1C', fontSize:11, fontWeight:700 }}>{erro}</span>}
    </span>
  );
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

// ========== GERADOR DE PDF PROFISSIONAL ==========
function gerarPDF(solicitacoes, policiais, semanaAtual) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const pendentes = solicitacoes.filter(s => s.status === 'pendente');
  const recusadas = solicitacoes.filter(s => s.status === 'recusado');
  const folgas = aprovadas.filter(s => s.motivo === 'Folga');
  const concessoes = aprovadas.filter(s => s.motivo === 'Concessão');
  const fimSemana = new Date(semanaAtual);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const periodoStr = `${semanaAtual.toLocaleDateString('pt-BR')} a ${fimSemana.toLocaleDateString('pt-BR')}`;
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const hojeHora = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const isoInicio = semanaAtual.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];
  const prontos = policiais.filter(p => (p.situacao||'Pronto') === 'Pronto');
  const afastados = policiais.filter(p => (p.situacao||'Pronto') !== 'Pronto');
  const semFolga = prontos.filter(p => !solicitacoes.find(s => s.policial_id === p.id && s.semana >= isoInicio && s.semana <= isoFim && s.status !== 'recusado'));
  const contPorDia = DIAS.map(dia => ({ dia, count: aprovadas.filter(s => s.dia === dia).length }));
  const diaMaisAtivo = contPorDia.reduce((a,b) => a.count >= b.count ? a : b, contPorDia[0]);
  const contPorSecao = SECOES.map(secao => ({ secao, count: aprovadas.filter(s => s.secao === secao).length })).filter(s => s.count > 0).sort((a,b) => b.count - a.count);
  const secaoMais = contPorSecao[0];
  const statusOp = pendentes.length === 0 ? 'NORMAL' : pendentes.length <= 3 ? 'ATENÇÃO' : 'CRÍTICO';
  const corStatusOp = statusOp === 'NORMAL' ? [27,94,32] : statusOp === 'ATENÇÃO' ? [123,88,0] : [183,28,28];
  const maxFolgasDia = Math.max(...contPorDia.map(d => d.count), 1);

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  function rodape(pagina, total) {
    doc.setDrawColor(200,210,220);
    doc.line(10, pageH-14, pageW-10, pageH-14);
    doc.setTextColor(150,160,170); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('PMERJ · 32º Batalhão de Polícia Militar · Sistema de Controle de Folgas — PCSV', pageW/2, pageH-9, { align:'center' });
    doc.text(`Emitido em ${hojeHora}`, 10, pageH-9);
    doc.text(`Pág. ${pagina}${total ? ` / ${total}` : ''}`, pageW-10, pageH-9, { align:'right' });
  }

  function cabecalhoPagina(titulo) {
    doc.setFillColor(13,35,64); doc.rect(0,0,pageW,14,'F');
    doc.setFillColor(30,77,123); doc.rect(0,14,pageW,4,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(titulo, pageW/2, 10, { align:'center' });
  }

  // =====================
  // PÁGINA 1 — CAPA
  // =====================
  doc.setFillColor(13,35,64); doc.rect(0,0,pageW,62,'F');
  doc.setFillColor(30,77,123); doc.rect(0,62,pageW,3,'F');
  doc.setFillColor(255,200,0); doc.rect(0,65,pageW,1,'F');

  doc.setTextColor(180,200,220); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('POLÍCIA MILITAR DO ESTADO DO RIO DE JANEIRO', pageW/2, 12, { align:'center' });
  doc.setTextColor(255,255,255); doc.setFontSize(17); doc.setFont('helvetica','bold');
  doc.text('32º BATALHÃO DE POLÍCIA MILITAR', pageW/2, 24, { align:'center' });
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('RELATÓRIO SEMANAL DE CONTROLE DE FOLGAS', pageW/2, 34, { align:'center' });
  doc.setFillColor(255,200,0); doc.rect(pageW/2-30,38,60,0.5,'F');
  doc.setTextColor(180,200,220); doc.setFontSize(9);
  doc.text(`Período: ${periodoStr}`, pageW/2, 46, { align:'center' });
  doc.text(`PCSV / Expediente Semanal · Emitido em ${hojeStr}`, pageW/2, 54, { align:'center' });

  // 4 CARDS
  let y = 74;
  const cards = [
    { label:'TOTAL', valor:solicitacoes.length, cor:[13,35,64], sub:'solicitações' },
    { label:'APROVADAS', valor:aprovadas.length, cor:[27,94,32], sub:'folgas/concessões' },
    { label:'PENDENTES', valor:pendentes.length, cor:[123,88,0], sub:'aguardando' },
    { label:'RECUSADAS', valor:recusadas.length, cor:[183,28,28], sub:'não autorizadas' },
  ];
  const cardW = (pageW - 24) / 4;
  cards.forEach((c, i) => {
    const x = 10 + i * (cardW + (14/3));
    doc.setFillColor(...c.cor); doc.roundedRect(x, y, cardW, 28, 2, 2, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(22); doc.setFont('helvetica','bold');
    doc.text(String(c.valor), x + cardW/2, y + 15, { align:'center' });
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text(c.label, x + cardW/2, y + 21, { align:'center' });
    doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(220,220,220);
    doc.text(c.sub, x + cardW/2, y + 26, { align:'center' });
  });

  // SITUAÇÃO OPERACIONAL
  y += 34;
  doc.setFillColor(...corStatusOp); doc.roundedRect(10, y, pageW-20, 14, 2, 2, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('SITUAÇÃO OPERACIONAL', pageW/2, y+5, { align:'center' });
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text(statusOp, pageW/2, y+12, { align:'center' });

  // RESUMO EXECUTIVO
  y += 20;
  doc.setFillColor(240,244,248); doc.roundedRect(10, y, pageW-20, 52, 2, 2, 'F');
  doc.setDrawColor(200,210,220); doc.roundedRect(10, y, pageW-20, 52, 2, 2, 'S');
  doc.setFillColor(13,35,64); doc.roundedRect(10, y, pageW-20, 9, 2, 2, 'F');
  doc.rect(10, y+5, pageW-20, 4, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('RESUMO EXECUTIVO', 16, y+6.5);

  const insights = [
    { icon:'►', texto:`Dia com maior concentração: ${diaMaisAtivo.count > 0 ? `${diaMaisAtivo.dia} (${diaMaisAtivo.count} solicitação${diaMaisAtivo.count>1?'s':''})` : 'Nenhum'}`, cor:[13,35,64] },
    { icon:'►', texto:`Seção mais impactada: ${secaoMais ? `${secaoMais.secao} com ${secaoMais.count} solicitação${secaoMais.count>1?'s':''}` : 'Nenhuma'}`, cor:[13,35,64] },
    { icon:'►', texto:`Folgas regulares: ${folgas.length}   |   Concessões: ${concessoes.length}`, cor:[13,35,64] },
    { icon:'►', texto:`Prontos sem solicitação esta semana: ${semFolga.length} de ${prontos.length}`, cor:[13,35,64] },
    { icon:'►', texto:`Efetivo total: ${policiais.length}   |   Prontos: ${prontos.length}   |   Afastados: ${afastados.length}`, cor:[13,35,64] },
  ];
  insights.forEach((ins, i) => {
    doc.setTextColor(...ins.cor); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`${ins.icon}  ${ins.texto}`, 16, y + 16 + i * 7);
  });

  // CAPACIDADE OPERACIONAL
  y += 58;
  const opCards = [
    { l:'Efetivo Total', v:policiais.length, c:[13,35,64] },
    { l:'Prontos p/ Serviço', v:prontos.length, c:[27,94,32] },
    { l:'Afastados', v:afastados.length, c:[183,28,28] },
    { l:'Folgas esta semana', v:aprovadas.length, c:[0,77,153] },
    { l:'Folgas regulares', v:folgas.length, c:[13,71,161] },
    { l:'Concessões', v:concessoes.length, c:[106,27,154] },
  ];
  const opW = (pageW - 24) / 3;
  opCards.forEach((c, i) => {
    const row = Math.floor(i/3);
    const col = i % 3;
    const x = 10 + col * (opW + 4);
    const yy = y + row * 20;
    doc.setFillColor(248,250,252); doc.roundedRect(x, yy, opW, 16, 1, 1, 'F');
    doc.setDrawColor(...c.c); doc.roundedRect(x, yy, opW, 16, 1, 1, 'S');
    doc.setFillColor(...c.c); doc.rect(x, yy, 3, 16, 'F');
    doc.setTextColor(...c.c); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(String(c.v), x + opW/2 + 2, yy + 10, { align:'center' });
    doc.setTextColor(100,110,120); doc.setFontSize(6); doc.setFont('helvetica','normal');
    doc.text(c.l.toUpperCase(), x + opW/2 + 2, yy + 14.5, { align:'center' });
  });

  rodape(1);

  // =====================
  // PÁGINA 2 — QUADRO POR DIA
  // =====================
  doc.addPage();
  cabecalhoPagina('QUADRO OPERACIONAL DETALHADO — DISTRIBUIÇÃO POR DIA');
  y = 22;

  if (aprovadas.length === 0) {
    doc.setTextColor(150,150,150); doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Nenhuma folga aprovada neste período.', pageW/2, y+20, { align:'center' });
  } else {
    DIAS.forEach(dia => {
      const dodia = aprovadas.filter(s => s.dia === dia);
      const isDiaSemUtil = dia === 'Sábado' || dia === 'Domingo';

      // Policiais de serviço = prontos sem folga aprovada naquele dia
      const deServicoDia = policiais.filter(p => {
        const temFolga = dodia.find(s => s.policial_id === p.id);
        const afastado = (p.situacao||'Pronto') !== 'Pronto';
        return !temFolga && !afastado;
      });

      if (dodia.length === 0 && deServicoDia.length === 0) {
        if (y > pageH - 30) { doc.addPage(); cabecalhoPagina('QUADRO OPERACIONAL DETALHADO (continuação)'); y = 22; }
        doc.setFillColor(isDiaSemUtil ? 245 : 235, isDiaSemUtil ? 245 : 238, isDiaSemUtil ? 245 : 242);
        doc.roundedRect(10, y, pageW-20, 9, 1, 1, 'F');
        doc.setTextColor(isDiaSemUtil ? 180 : 120, isDiaSemUtil ? 180 : 130, isDiaSemUtil ? 180 : 140);
        doc.setFontSize(8); doc.setFont('helvetica','bold');
        doc.text(dia.toUpperCase(), 15, y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(7);
        doc.text('Sem registros', pageW-15, y+6, { align:'right' });
        y += 12;
        return;
      }

      if (y > pageH - 50) { doc.addPage(); cabecalhoPagina('QUADRO OPERACIONAL DETALHADO (continuação)'); y = 22; }

      // Cabeçalho do dia com barra de intensidade
      const intensidade = dodia.length / maxFolgasDia;
      const r = Math.round(13 + (30-13) * (1-intensidade));
      const g = Math.round(35 + (77-35) * (1-intensidade));
      const b = Math.round(64 + (123-64) * (1-intensidade));
      doc.setFillColor(r, g, b); doc.roundedRect(10, y, pageW-20, 11, 1, 1, 'F');
      doc.setFillColor(255,200,0); doc.rect(10, y, Math.max(3,(pageW-20)*intensidade), 2, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(dia.toUpperCase(), 15, y+8);
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(`De Folga: ${dodia.length}  |  De Serviço: ${deServicoDia.length}`, pageW-15, y+8, { align:'right' });
      y += 13;

      // TABELA DE FOLGA
      if (dodia.length > 0) {
        doc.setFillColor(227,242,253); doc.roundedRect(10, y, pageW-20, 7, 1, 1, 'F');
        doc.setTextColor(13,71,161); doc.setFontSize(7); doc.setFont('helvetica','bold');
        doc.text(`DE FOLGA / CONCESSAO (${dodia.length})`, 15, y+5);
        y += 8;
        doc.autoTable({
          startY: y,
          head: [['Seção', 'Patente / Nome', 'Tipo']],
          body: dodia.map(s => [
            s.secao && s.secao !== '—' ? s.secao : 'Não vinculada',
            `${s.patente} ${s.policial_nome}`,
            s.motivo,
          ]),
          theme: 'grid',
          headStyles: { fillColor:[13,71,161], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2 },
          bodyStyles: { fontSize:7, cellPadding:2 },
          columnStyles: {
            0: { cellWidth:32, fontStyle:'bold' },
            2: { cellWidth:22, halign:'center' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
              data.cell.styles.textColor = data.cell.raw === 'Folga' ? [13,71,161] : [106,27,154];
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body' && data.row.index % 2 === 0) {
              data.cell.styles.fillColor = [248,250,252];
            }
          },
          margin: { left:10, right:10 },
        });
        y = doc.lastAutoTable.finalY + 4;
      }

      // TABELA DE SERVIÇO em 2 colunas
      if (deServicoDia.length > 0) {
        if (y > pageH - 40) { doc.addPage(); cabecalhoPagina('QUADRO OPERACIONAL DETALHADO (continuação)'); y = 22; }
        doc.setFillColor(232,245,233); doc.roundedRect(10, y, pageW-20, 7, 1, 1, 'F');
        doc.setTextColor(27,94,32); doc.setFontSize(7); doc.setFont('helvetica','bold');
        doc.text(`DE SERVICO (${deServicoDia.length})`, 15, y+5);
        y += 8;

        const metade = Math.ceil(deServicoDia.length/2);
        const col1 = deServicoDia.slice(0, metade);
        const col2 = deServicoDia.slice(metade);
        const maxRows = Math.max(col1.length, col2.length);
        const bodyServico = Array.from({length: maxRows}, (_, i) => [
          col1[i] ? `${col1[i].patente} ${col1[i].nome.split(' ').slice(0,2).join(' ')}` : '',
          col1[i] ? (col1[i].secao || '—') : '',
          col2[i] ? `${col2[i].patente} ${col2[i].nome.split(' ').slice(0,2).join(' ')}` : '',
          col2[i] ? (col2[i].secao || '—') : '',
        ]);

        doc.autoTable({
          startY: y,
          head: [['Policial', 'Seção', 'Policial', 'Seção']],
          body: bodyServico,
          theme: 'grid',
          headStyles: { fillColor:[27,94,32], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2 },
          bodyStyles: { fontSize:7, cellPadding:2 },
          columnStyles: {
            1: { cellWidth:20, halign:'center' },
            3: { cellWidth:20, halign:'center' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index % 2 === 0) {
              data.cell.styles.fillColor = [248,252,248];
            }
          },
          margin: { left:10, right:10 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }
    });
  }

  rodape(2);

  // =====================
  // PÁGINA 3 — ESTATÍSTICAS
  // =====================
  doc.addPage();
  cabecalhoPagina('ESTATÍSTICAS, SITUAÇÃO DO EFETIVO E MATRIZ DE DISTRIBUIÇÃO');
  y = 22;

  // SITUAÇÃO SANITÁRIA COM CORES
  doc.setFillColor(30,77,123); doc.roundedRect(10,y,pageW-20,8,1,1,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('SITUAÇÃO SANITÁRIA DO EFETIVO', 15, y+5.5);
  y += 10;

  const aptoAS = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto A'&&!temRestricao(p)).length;
  const aptoAC = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto A'&&temRestricao(p)).length;
  const aptoB = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto B').length;
  const aptoC = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto C').length;
  const lts = policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='LTS').length;

  const ssData = [
    { label:'Apto A — Sem Restrição', total:aptoAS, cor:[21,101,192], bg:[227,242,253] },
    { label:'Apto A — Com Restrição', total:aptoAC, cor:[230,81,0], bg:[255,243,224] },
    { label:'Apto B', total:aptoB, cor:[249,168,37], bg:[255,248,225] },
    { label:'Apto C', total:aptoC, cor:[183,28,28], bg:[255,235,238] },
    { label:'LTS Sanitário', total:lts, cor:[106,27,154], bg:[243,229,245] },
  ];
  const ssW = (pageW-24)/ssData.length;
  ssData.forEach((s, i) => {
    const x = 10 + i*(ssW+1);
    doc.setFillColor(...s.bg); doc.roundedRect(x, y, ssW, 18, 1, 1, 'F');
    doc.setDrawColor(...s.cor); doc.roundedRect(x, y, ssW, 18, 1, 1, 'S');
    doc.setFillColor(...s.cor); doc.rect(x, y, ssW, 2.5, 'F');
    doc.setTextColor(...s.cor); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(String(s.total), x+ssW/2, y+12, { align:'center' });
    doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text(s.label.toUpperCase(), x+ssW/2, y+17, { align:'center' });
  });
  y += 22;

  // SITUAÇÃO DO EFETIVO + PRONTOS SEM SOLICITAÇÃO lado a lado
  const colW = (pageW-24)/2;

  // Coluna esquerda — Situação
  doc.setFillColor(30,77,123); doc.roundedRect(10,y,colW,8,1,1,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('SITUAÇÃO DO EFETIVO', 15, y+5.5);

  const sitBody = SITUACOES.map(s => {
    const total = policiais.filter(p=>(p.situacao||'Pronto')===s).length;
    return [s, String(total)];
  }).filter(r => parseInt(r[1]) > 0);

  doc.autoTable({
    startY: y+9,
    head: [['Situação','Total']],
    body: sitBody,
    theme: 'grid',
    headStyles: { fillColor:[50,90,140], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2 },
    bodyStyles: { fontSize:7.5, cellPadding:2 },
    columnStyles: { 1: { halign:'center', fontStyle:'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.cell.raw === 'Pronto') data.cell.styles.textColor = [27,94,32];
      if (data.section === 'body' && data.row.index % 2 === 0) data.cell.styles.fillColor = [248,250,252];
    },
    margin: { left:10, right: pageW/2+2 },
  });
  const yAposSit = doc.lastAutoTable.finalY;

  // Coluna direita — Prontos sem solicitação em 2 colunas
  doc.setFillColor(13,35,64); doc.roundedRect(pageW/2+2, y, colW, 8, 1, 1, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`PRONTOS SEM SOLICITAÇÃO (${semFolga.length})`, pageW/2+7, y+5.5);

  if (semFolga.length > 0) {
    const metade = Math.ceil(semFolga.length/2);
    const col1 = semFolga.slice(0,metade).map(p=>[`${p.patente} ${p.nome.split(' ').slice(0,2).join(' ')}`, p.secao||'—']);
    const col2 = semFolga.slice(metade).map(p=>[`${p.patente} ${p.nome.split(' ').slice(0,2).join(' ')}`, p.secao||'—']);
    const maxRows = Math.max(col1.length, col2.length);
    const bodyDuplo = Array.from({length:maxRows}, (_,i) => [
      col1[i]?col1[i][0]:'', col1[i]?col1[i][1]:'',
      col2[i]?col2[i][0]:'', col2[i]?col2[i][1]:'',
    ]);
    doc.autoTable({
      startY: y+9,
      head: [['Nome','Seção','Nome','Seção']],
      body: bodyDuplo,
      theme: 'grid',
      headStyles: { fillColor:[13,35,64], textColor:255, fontStyle:'bold', fontSize:6, cellPadding:1.5 },
      bodyStyles: { fontSize:6, cellPadding:1.5 },
      columnStyles: { 1:{ cellWidth:14, halign:'center' }, 3:{ cellWidth:14, halign:'center' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index % 2 === 0) data.cell.styles.fillColor = [248,250,252];
      },
      margin: { left: pageW/2+2, right:10 },
    });
  }

  y = Math.max(yAposSit, doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 8;

  // MATRIZ DE DISTRIBUIÇÃO COM CORES POR INTENSIDADE
  if (aprovadas.length > 0) {
    if (y > pageH - 60) { doc.addPage(); cabecalhoPagina('MATRIZ DE DISTRIBUIÇÃO'); y = 22; }

    doc.setFillColor(30,77,123); doc.roundedRect(10,y,pageW-20,8,1,1,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('MATRIZ DE DISTRIBUIÇÃO POR SEÇÃO E DIA', 15, y+5.5);
    y += 10;

    const secoesComFolga = [...new Set(aprovadas.map(s => s.secao))].sort();
    const maxCelula = Math.max(...secoesComFolga.map(sec => Math.max(...DIAS.map(dia => aprovadas.filter(s=>s.secao===sec&&s.dia===dia).length))), 1);

    const bodyMatriz = secoesComFolga.map(secao => [
      secao,
      ...DIAS.map(dia => {
        const c = aprovadas.filter(s=>s.secao===secao&&s.dia===dia).length;
        return c > 0 ? String(c) : '—';
      }),
      String(aprovadas.filter(s=>s.secao===secao).length),
    ]);
    bodyMatriz.push([
      'TOTAL',
      ...DIAS.map(dia => {
        const c = aprovadas.filter(s=>s.dia===dia).length;
        return c > 0 ? String(c) : '—';
      }),
      String(aprovadas.length),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Seção', ...DIAS.map(d=>d.substring(0,3)), 'Total']],
      body: bodyMatriz,
      theme: 'grid',
      headStyles: { fillColor:[13,35,64], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2, halign:'center' },
      bodyStyles: { fontSize:7, cellPadding:2, halign:'center' },
      columnStyles: { 0:{ halign:'left', fontStyle:'bold', cellWidth:28 } },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const isTotal = data.row.index === bodyMatriz.length - 1;
          if (isTotal) {
            data.cell.styles.fillColor = [220,228,240];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [13,35,64];
            return;
          }
          if (data.column.index > 0 && data.column.index < 8) {
            const val = parseInt(data.cell.raw);
            if (!isNaN(val) && val > 0) {
              const intensidade = val / maxCelula;
              const r = Math.round(255 - intensidade * (255-13));
              const g = Math.round(255 - intensidade * (255-71));
              const b = Math.round(255 - intensidade * (255-161));
              data.cell.styles.fillColor = [r, g, b];
              data.cell.styles.textColor = intensidade > 0.5 ? [255,255,255] : [13,35,64];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          if (data.row.index % 2 === 0 && data.column.index === 0) {
            data.cell.styles.fillColor = [248,250,252];
          }
        }
      },
      margin: { left:10, right:10 },
    });
  }

  // =====================
  // BLOCO DE AFASTADOS
  // =====================
  const afastadosSit = policiais.filter(p => (p.situacao||'Pronto') !== 'Pronto');
  const afastadosLTS = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'LTS');

  if (afastadosSit.length > 0 || afastadosLTS.length > 0) {
    doc.addPage(); cabecalhoPagina('POLICIAIS AFASTADOS'); y = 22;
    doc.setFillColor(30,77,123); doc.roundedRect(10, y, pageW-20, 8, 1, 1, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('POLICIAIS AFASTADOS', 15, y+5.5);
    y += 10;

    // Situações administrativas
SITUACOES.filter(sit => sit !== 'Pronto' && sit !== 'LTS').forEach(sit => {      const grupo = afastadosSit.filter(p => (p.situacao||'Pronto') === sit);
      if (grupo.length === 0) return;
      if (y > pageH - 30) { doc.addPage(); cabecalhoPagina('POLICIAIS AFASTADOS (continuação)'); y = 22; }
      doc.setFillColor(255,235,238); doc.roundedRect(10, y, pageW-20, 7, 1, 1, 'F');
      doc.setTextColor(183,28,28); doc.setFontSize(7); doc.setFont('helvetica','bold');
      doc.text(`${sit.toUpperCase()} (${grupo.length})`, 15, y+5);
      y += 8;
      doc.autoTable({
        startY: y,
        head: [['Patente / Nome', 'Início', 'Término', 'Situação']],
        body: grupo.map(p => {
          const ini = p.ferias_inicio ? new Date(p.ferias_inicio+'T00:00:00').toLocaleDateString('pt-BR') : '—';
          const fim = p.ferias_fim ? new Date(p.ferias_fim+'T00:00:00').toLocaleDateString('pt-BR') : '—';
          const dias = p.ferias_fim ? diasParaRetorno(p.ferias_fim) : null;
          const sitLabel = dias === null ? '—' : dias < 0 ? 'VENCIDO' : dias === 0 ? 'Retorna hoje' : `${dias} dias`;
          return [`${p.patente} ${p.nome}`, ini, fim, sitLabel];
        }),
        theme: 'grid',
        headStyles: { fillColor:[183,28,28], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2 },
        bodyStyles: { fontSize:7, cellPadding:2 },
        columnStyles: { 0:{ cellWidth:80 }, 1:{ cellWidth:24, halign:'center' }, 2:{ cellWidth:24, halign:'center' }, 3:{ cellWidth:24, halign:'center' } },
        didParseCell: (data) => {
          if (data.section==='body' && data.row.index%2===0) data.cell.styles.fillColor=[255,245,245];
        },
        margin: { left:10, right:10 },
      });
      y = doc.lastAutoTable.finalY + 4;
    });

    // LTS Sanitário
    if (afastadosLTS.length > 0) {
      if (y > pageH - 30) { doc.addPage(); cabecalhoPagina('POLICIAIS AFASTADOS (continuação)'); y = 22; }
      doc.setFillColor(243,229,245); doc.roundedRect(10, y, pageW-20, 7, 1, 1, 'F');
      doc.setTextColor(106,27,154); doc.setFontSize(7); doc.setFont('helvetica','bold');
      doc.text(`LTS SANITARIO (${afastadosLTS.length})`, 15, y+5);
      y += 8;
      doc.autoTable({
        startY: y,
        head: [['Patente / Nome', 'Início LTS', 'Término LTS', 'Situação']],
        body: afastadosLTS.map(p => {
          const ini = p.ss_inicio ? new Date(p.ss_inicio+'T00:00:00').toLocaleDateString('pt-BR') : '—';
          const fim = p.ss_fim ? new Date(p.ss_fim+'T00:00:00').toLocaleDateString('pt-BR') : '—';
          const dias = p.ss_fim ? diasParaRetorno(p.ss_fim) : null;
          const sitLabel = dias === null ? 'Sem data' : dias < 0 ? 'VENCIDO' : dias === 0 ? 'Encerra hoje' : `${dias} dias`;
          return [`${p.patente} ${p.nome}`, ini, fim, sitLabel];
        }),
        theme: 'grid',
        headStyles: { fillColor:[106,27,154], textColor:255, fontStyle:'bold', fontSize:7, cellPadding:2 },
        bodyStyles: { fontSize:7, cellPadding:2 },
        columnStyles: { 0:{ cellWidth:80 }, 1:{ cellWidth:24, halign:'center' }, 2:{ cellWidth:24, halign:'center' }, 3:{ cellWidth:24, halign:'center' } },
        didParseCell: (data) => {
          if (data.section==='body' && data.row.index%2===0) data.cell.styles.fillColor=[250,245,255];
        },
        margin: { left:10, right:10 },
      });
      y = doc.lastAutoTable.finalY + 4;
    }
  }

  rodape(3);
  doc.save(`relatorio-32bpm-${periodoStr.replace(/\//g,'-').replace(/ /g,'')}.pdf`);
}

// ========== DASHBOARD (ORIGINAL COMPLETO) ==========
function Dashboard({ solicitacoes, policiais, onAtualizarPolicial, onRemoverPolicial, semanaAtual }) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const total = solicitacoes.length;
  const totalAprovadas = aprovadas.length;
  const totalPendentes = solicitacoes.filter(s => s.status === 'pendente').length;
  const totalRecusadas = solicitacoes.filter(s => s.status === 'recusado').length;
  const totalFolgas = aprovadas.filter(s => s.motivo === 'Folga').length;
  const totalConcessoes = aprovadas.filter(s => s.motivo === 'Concessão').length;
  const porDia = DIAS.map(dia => ({ dia:dia.substring(0,3), Folgas:aprovadas.filter(s=>s.dia===dia&&s.motivo==='Folga').length, Concessões:aprovadas.filter(s=>s.dia===dia&&s.motivo==='Concessão').length }));
  const porSecao = SECOES.map(secao => ({ secao, total:aprovadas.filter(s=>s.secao===secao).length })).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
  const totalPorDia = porDia.map(d => d.Folgas + d.Concessões);
  const maxDia = Math.max(...totalPorDia);
  const mediaDia = totalPorDia.reduce((a,b)=>a+b,0) / 7;
  const diaCritico = porDia.find(d => (d.Folgas+d.Concessões) === maxDia && maxDia > 0);
  const desbalanceado = maxDia > 0 && (maxDia - Math.min(...totalPorDia.filter(v=>v>0))) >= 3;
  const semSecao = policiais.filter(p => !p.secao || p.secao === '');
  const retornosProximos = policiais.filter(p => p.situacao === 'Férias' && p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && diasParaRetorno(p.ferias_fim) <= 3 && diasParaRetorno(p.ferias_fim) >= 0);
  const ltsProximos = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'LTS' && p.ss_fim && diasParaRetorno(p.ss_fim) !== null && diasParaRetorno(p.ss_fim) <= 3 && diasParaRetorno(p.ss_fim) >= 0);
  const aptoBProximos = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'Apto B' && p.ss_fim && diasParaRetorno(p.ss_fim) !== null && diasParaRetorno(p.ss_fim) <= 3 && diasParaRetorno(p.ss_fim) >= 0);
  const aptoCProximos = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'Apto C' && p.ss_fim && diasParaRetorno(p.ss_fim) !== null && diasParaRetorno(p.ss_fim) <= 3 && diasParaRetorno(p.ss_fim) >= 0);
  const aptoAComRestricao = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'Apto A' && temRestricao(p));
  const aptoASemRestricao = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'Apto A' && !temRestricao(p));
  const ssCards = [
    { label:'Apto A', total:aptoASemRestricao.length, cor:'#1565C0', emoji:'🔵' },
    ...(aptoAComRestricao.length > 0 ? [{ label:'Apto A c/ Restrição', total:aptoAComRestricao.length, cor:'#E65100', emoji:'🟠' }] : []),
    { label:'Apto B', total:policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto B').length, cor:'#F9A825', emoji:'🟡' },
    { label:'Apto C', total:policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='Apto C').length, cor:'#B71C1C', emoji:'🔴' },
    { label:'LTS', total:policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='LTS').length, cor:'#6A1B9A', emoji:'🟣' },
  ];
  const sitData = SITUACOES.map(s => ({ name:s, value:policiais.filter(p=>(p.situacao||'Pronto')===s).length })).filter(s=>s.value>0);
  const fimSemana = new Date(semanaAtual);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const isoInicio = semanaAtual.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];
  const prontos = policiais.filter(p => (p.situacao||'Pronto') === 'Pronto');
  const semFolga = prontos.filter(p => !solicitacoes.find(s => s.policial_id === p.id && s.semana >= isoInicio && s.semana <= isoFim && s.status !== 'recusado'));

  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:16 }}>📈 Dashboard de Estatísticas</h3>

      {retornosProximos.length > 0 && (
        <div style={{ background:'#FFF3E0', border:'2px solid #FFB74D', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#E65100', fontSize:13, marginBottom:8 }}>⏰ Férias encerrando em até 3 dias:</div>
          {retornosProximos.map(p => { const dias = diasParaRetorno(p.ferias_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#B71C1C':dias<=1?'#E65100':'#F9A825', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Retorna hoje!':dias===1?'Retorna amanhã!':`${dias} dias`}</span></div>); })}
        </div>
      )}

      {ltsProximos.length > 0 && (
        <div style={{ background:'#F3E5F5', border:'2px solid #CE93D8', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#6A1B9A', fontSize:13, marginBottom:8 }}>🟣 LTS Sanitário encerrando em até 3 dias:</div>
          {ltsProximos.map(p => { const dias = diasParaRetorno(p.ss_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#6A1B9A':'#AB47BC', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Encerra hoje!':dias===1?'Encerra amanhã!':`${dias} dias`}</span></div>); })}
        </div>
      )}

      {aptoBProximos.length > 0 && (
        <div style={{ background:'#FFF8E1', border:'2px solid #FFD54F', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#F9A825', fontSize:13, marginBottom:8 }}>🟡 Apto B encerrando em até 3 dias:</div>
          {aptoBProximos.map(p => { const dias = diasParaRetorno(p.ss_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#F9A825':dias<=1?'#F57F17':'#FFA000', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Encerra hoje!':dias===1?'Encerra amanhã!':`${dias} dias`}</span></div>); })}
        </div>
      )}

      {aptoCProximos.length > 0 && (
        <div style={{ background:'#FFEBEE', border:'2px solid #EF9A9A', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#B71C1C', fontSize:13, marginBottom:8 }}>🔴 Apto C encerrando em até 3 dias:</div>
          {aptoCProximos.map(p => { const dias = diasParaRetorno(p.ss_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#B71C1C':'#E53935', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Encerra hoje!':dias===1?'Encerra amanhã!':`${dias} dias`}</span></div>); })}
        </div>
      )}

      {semSecao.length > 0 && (
        <div style={{ background:'#FFEBEE', border:'2px solid #EF9A9A', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#B71C1C', fontSize:13, marginBottom:8 }}>⚠️ {semSecao.length} policial(is) sem seção definida:</div>
          {semSecao.map(p => (
            <div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:6, background:'#fff', borderRadius:8, padding:'6px 10px', border:'1px solid #EF9A9A' }}>
              <span style={{ fontWeight:700, color:'#B71C1C', fontSize:12, flex:1 }}>{p.patente} {p.nome}</span>
              <select defaultValue="" onChange={e => { if(e.target.value) onAtualizarPolicial(p.id,'secao',e.target.value); }} style={{ fontSize:12, padding:'4px 6px', borderRadius:6, border:'1px solid #d0dce8', color:'#1a3a5c', background:'#f8fafc' }}>
                <option value="" disabled>— Atribuir seção —</option>
                {SECOES.map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => onRemoverPolicial(p.id)} style={{ background:'#FFEBEE', color:'#B71C1C', border:'none', borderRadius:6, padding:'4px 8px', fontSize:12, fontWeight:700, cursor:'pointer' }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {semFolga.length > 0 && (
        <div style={{ background:'#E3F2FD', border:'2px solid #90CAF9', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontWeight:800, color:'#0D47A1', fontSize:13, marginBottom:8 }}>📋 {semFolga.length} policial(is) Pronto(s) sem solicitação esta semana:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {semFolga.map(p => <span key={p.id} style={{ background:'#fff', color:'#0D47A1', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, border:'1px solid #90CAF9' }}>{p.patente} {p.nome.split(' ').slice(0,2).join(' ')}</span>)}
          </div>
        </div>
      )}

      {aprovadas.length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:12 }}>🔍 Insights Automáticos</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {diaCritico && <div style={{ background:'#FFEBEE', borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:16 }}>🔴</span><span style={{ fontSize:13, color:'#B71C1C', fontWeight:700 }}>Dia crítico: <strong>{diaCritico.dia}</strong> com {diaCritico.Folgas+diaCritico.Concessões} folgas ({Math.round(((diaCritico.Folgas+diaCritico.Concessões)/totalAprovadas)*100)}% do total)</span></div>}
            {desbalanceado && <div style={{ background:'#FFF8E1', borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:16 }}>⚠️</span><span style={{ fontSize:13, color:'#7B5800', fontWeight:700 }}>Desbalanceamento detectado: distribuição irregular entre os dias da semana</span></div>}
            {porSecao.length > 0 && <div style={{ background:'#E8F5E9', borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:16 }}>📊</span><span style={{ fontSize:13, color:'#1B5E20', fontWeight:700 }}>Seção mais ativa: <strong>{porSecao[0].secao}</strong> ({Math.round((porSecao[0].total/totalAprovadas)*100)}% das folgas)</span></div>}
            <div style={{ background:'#E3F2FD', borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}><span style={{ fontSize:16 }}>📈</span><span style={{ fontSize:13, color:'#0D47A1', fontWeight:700 }}>Média de {mediaDia.toFixed(1)} folgas por dia da semana</span></div>
          </div>
        </Card>
      )}

      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:12 }}>⚙️ Capacidade Operacional</h4>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
          {[
            { l:'Total do Efetivo', v:policiais.length, c:'#1a3a5c' },
            { l:'Prontos p/ Serviço', v:prontos.length, c:'#1B5E20' },
            { l:'Afastados', v:policiais.filter(p=>(p.situacao||'Pronto')!=='Pronto').length, c:'#B71C1C' },
            { l:'Com Restrição', v:policiais.filter(p=>temRestricao(p)).length, c:'#E65100' },
            { l:'Sem folga esta semana', v:semFolga.length, c:'#0D47A1' },
            { l:'LTS Sanitário', v:policiais.filter(p=>(p.sit_sanitaria||'Apto A')==='LTS').length, c:'#6A1B9A' },
          ].map(s => <div key={s.l} style={{ background:'#f8fafc', borderRadius:10, padding:'12px 8px', textAlign:'center', border:'1px solid #e0e8f0' }}><div style={{ fontSize:22, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:10, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
        </div>
      </Card>

      {policiais.filter(p => (p.situacao||'Pronto') !== 'Pronto' || (p.sit_sanitaria||'Apto A') === 'LTS').length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:12 }}>🚨 Policiais Afastados</h4>

          {/* SITUAÇÃO ADMINISTRATIVA (Férias, LE, etc — exceto LTS que é tratado separadamente) */}
          {SITUACOES.filter(sit => sit !== 'Pronto' && sit !== 'LTS').map(sit => {
            const afastados = policiais.filter(p => (p.situacao||'Pronto') === sit);
            if (afastados.length === 0) return null;
            const isFerias = sit === 'Férias';
            return (
              <div key={sit} style={{ marginBottom:12 }}>
                <div style={{ fontWeight:800, color:'#B71C1C', fontSize:12, marginBottom:6, background:'#FFEBEE', borderRadius:6, padding:'4px 10px', display:'inline-block' }}>{sit} ({afastados.length})</div>
                {afastados.map(p => {
                  const dataInicio = isFerias ? p.ferias_inicio : null;
                  const dataFim = isFerias ? p.ferias_fim : null;
                  const dias = dataFim ? diasParaRetorno(dataFim) : null;
                  return (
                    <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f0f4f8', flexWrap:'wrap', gap:6 }}>
                      <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {dataFim && <span style={{ color:'#6b8099', fontSize:11 }}>{dataInicio?new Date(dataInicio+'T00:00:00').toLocaleDateString('pt-BR'):'—'} → {new Date(dataFim+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        {dias!==null&&dias>=0&&<span style={{ background:dias<=3?'#B71C1C':'#1B5E20', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Retorna hoje!':dias===1?'1 dia':`${dias} dias`}</span>}
                        {dias!==null&&dias<0&&<span style={{ background:'#7B5800', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>Vencido</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* LTS SANITÁRIO */}
          {(() => {
            const ltsPolcs = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'LTS');
            if (ltsPolcs.length === 0) return null;
            return (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontWeight:800, color:'#6A1B9A', fontSize:12, marginBottom:6, background:'#F3E5F5', borderRadius:6, padding:'4px 10px', display:'inline-block' }}>🟣 LTS Sanitário ({ltsPolcs.length})</div>
                {ltsPolcs.map(p => {
                  const dias = p.ss_fim ? diasParaRetorno(p.ss_fim) : null;
                  return (
                    <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f0f4f8', flexWrap:'wrap', gap:6 }}>
                      <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {p.ss_fim && <span style={{ color:'#6b8099', fontSize:11 }}>{p.ss_inicio?new Date(p.ss_inicio+'T00:00:00').toLocaleDateString('pt-BR'):'—'} → {new Date(p.ss_fim+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        {dias!==null&&dias>=0&&<span style={{ background:dias<=3?'#6A1B9A':'#1B5E20', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Encerra hoje!':dias===1?'1 dia':`${dias} dias`}</span>}
                        {dias!==null&&dias<0&&<span style={{ background:'#7B5800', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>Vencido</span>}
                        {!p.ss_fim&&<span style={{ color:'#aab', fontSize:11 }}>Sem data cadastrada</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:20 }}>
        {[{l:'Total',v:total,c:'#1a3a5c'},{l:'Folgas aprovadas',v:totalFolgas,c:'#0D47A1'},{l:'Concessões aprovadas',v:totalConcessoes,c:'#6A1B9A'},{l:'Pendentes',v:totalPendentes,c:'#7B5800'},{l:'Recusadas',v:totalRecusadas,c:'#B71C1C'},{l:'Total aprovadas',v:totalAprovadas,c:'#1B5E20'}]
          .map(s => <div key={s.l} style={{ background:'#fff', borderRadius:10, padding:'14px 10px', boxShadow:'0 2px 8px #00000012', textAlign:'center' }}><div style={{ fontSize:26, fontWeight:900, color:s.c }}>{s.v}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.l}</div></div>)}
      </div>

      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Situação Sanitária do Efetivo</h4>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {ssCards.map(s => <div key={s.label} style={{ flex:1, minWidth:90, background:s.cor+'18', borderRadius:10, padding:'12px 8px', textAlign:'center', border:`2px solid ${s.cor}` }}><div style={{ fontSize:22 }}>{s.emoji}</div><div style={{ fontSize:20, fontWeight:900, color:s.cor }}>{s.total}</div><div style={{ fontSize:10, color:'#6b8099', fontWeight:700 }}>{s.label}</div></div>)}
        </div>
      </Card>

      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Situação do Efetivo</h4>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {sitData.map(s => <div key={s.name} style={{ background:s.name==='Pronto'?'#E8F5E9':'#FFEBEE', borderRadius:8, padding:'8px 14px', textAlign:'center' }}><div style={{ fontSize:18, fontWeight:900, color:s.name==='Pronto'?'#1B5E20':'#B71C1C' }}>{s.value}</div><div style={{ fontSize:11, color:'#6b8099', fontWeight:700 }}>{s.name}</div></div>)}
        </div>
      </Card>

      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Folgas aprovadas por dia da semana</h4>
        {aprovadas.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma folga aprovada ainda.</p>
          : <ResponsiveContainer width="100%" height={200}><BarChart data={porDia} margin={{ top:5, right:10, left:-20, bottom:5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="dia" tick={{ fontSize:11 }} /><YAxis tick={{ fontSize:11 }} allowDecimals={false} /><Tooltip /><Bar dataKey="Folgas" fill="#0D47A1" radius={[4,4,0,0]} /><Bar dataKey="Concessões" fill="#6A1B9A" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>}
      </Card>

      <Card>
        <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>Distribuição por seção (%)</h4>
        {porSecao.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma folga aprovada ainda.</p>
          : <><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={porSecao} dataKey="total" nameKey="secao" cx="50%" cy="50%" outerRadius={80} label={({ secao, total }) => `${secao} ${Math.round((total/totalAprovadas)*100)}%`} labelLine={false} fontSize={9}>{porSecao.map((_,i) => <Cell key={i} fill={CORES_GRAFICO[i%CORES_GRAFICO.length]} />)}</Pie><Tooltip formatter={(v,n) => [`${v} folgas (${Math.round((v/totalAprovadas)*100)}%)`, n]} /></PieChart></ResponsiveContainer><div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>{porSecao.map((s,i) => <span key={s.secao} style={{ background:CORES_GRAFICO[i%CORES_GRAFICO.length], color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{s.secao}: {s.total} ({Math.round((s.total/totalAprovadas)*100)}%)</span>)}</div></>}
      </Card>
    </div>
  );
}

// ========== CALENDÁRIO (ORIGINAL COMPLETO) ==========
function CalendarioFolgas({ solicitacoes }) {
  const aprovadas = solicitacoes.filter(s => s.status === 'aprovado');
  const [filtroSecao, setFiltroSecao] = useState('todas');
  const [semanaCalendario, setSemanaCalendario] = useState(() => getInicioSemana(new Date()));

  function semanaAnteriorCal() { const d = new Date(semanaCalendario); d.setDate(d.getDate()-7); setSemanaCalendario(d); }
  function proximaSemanaCalendario() { const d = new Date(semanaCalendario); d.setDate(d.getDate()+7); setSemanaCalendario(d); }

  const fimSemana = new Date(semanaCalendario);
  fimSemana.setDate(fimSemana.getDate() + 6);
  const isoInicio = semanaCalendario.toISOString().split('T')[0];
  const isoFim = fimSemana.toISOString().split('T')[0];
  const aprovadasSemana = aprovadas.filter(s => s.semana >= isoInicio && s.semana <= isoFim);
  const filtradas = filtroSecao === 'todas' ? aprovadasSemana : aprovadasSemana.filter(s => s.secao === filtroSecao);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0f4f8', borderRadius:10, padding:'8px 14px', marginBottom:12 }}>
        <button onClick={semanaAnteriorCal} style={{ ...btnSm, background:'#fff', color:'#1a3a5c' }}>← Anterior</button>
        <span style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>{formatarSemana(semanaCalendario)}</span>
        <button onClick={proximaSemanaCalendario} style={{ ...btnSm, background:'#fff', color:'#1a3a5c' }}>Próxima →</button>
      </div>
      <select value={filtroSecao} onChange={e => setFiltroSecao(e.target.value)} style={{ ...inp, marginBottom:12 }}>
        <option value="todas">Todas as seções</option>
        {SECOES.map(s => <option key={s}>{s}</option>)}
      </select>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700 }}>🌙 Folga</span>
        <span style={{ background:'#F3E5F5', color:'#6A1B9A', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:700 }}>🎖️ Concessão</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead><tr>{DIAS.map(d => <th key={d} style={{ background:'#1a3a5c', color:'#fff', padding:'10px 6px', fontSize:12, fontWeight:800, textAlign:'center', border:'1px solid #0d2340' }}>{d}</th>)}</tr></thead>
          <tbody><tr>{DIAS.map(dia => { const dodia = filtradas.filter(s => s.dia === dia); return (<td key={dia} style={{ verticalAlign:'top', padding:6, border:'1px solid #d0dce8', background:'#f8fafc', minWidth:80 }}>{dodia.length === 0 ? <span style={{ color:'#ccc', fontSize:11 }}>—</span> : dodia.map(s => (<div key={s.id} style={{ background:s.motivo==='Concessão'?'#F3E5F5':'#E3F2FD', color:s.motivo==='Concessão'?'#6A1B9A':'#0D47A1', borderRadius:6, padding:'4px 6px', marginBottom:4, fontSize:11, fontWeight:700 }}><div>{s.policial_nome.split(' ').slice(0,2).join(' ')}</div><div style={{ fontSize:10, opacity:0.8 }}>{s.secao&&s.secao!=='—'?s.secao:'Não vinculada'}</div></div>))}{dodia.length > 0 && <div style={{ fontSize:10, color:'#6b8099', marginTop:2, textAlign:'right' }}>{dodia.length} folga{dodia.length>1?'s':''}</div>}</td>); })}</tr></tbody>
        </table>
      </div>
      {filtradas.length === 0 && <p style={{ color:'#aab', fontSize:13, textAlign:'center', marginTop:20 }}>Nenhuma folga aprovada nesta semana.</p>}
    </div>
  );
}

// ========== TELA DE SERVIÇO ==========
function TelaServico({ solicitacoes, policiais }) {
  const hoje = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [secaoFiltro, setSecaoFiltro] = useState('todas');

  const diaSemana = DIAS[new Date(dataSelecionada + 'T12:00:00').getDay() === 0 ? 6 : new Date(dataSelecionada + 'T12:00:00').getDay() - 1];

  // Folgas aprovadas naquele dia (semana contém a data selecionada e dia da semana bate)
  const folgasNoDia = solicitacoes.filter(s =>
    s.status === 'aprovado' &&
    s.dia === diaSemana &&
    s.semana <= dataSelecionada &&
    (() => {
      const inicioSemana = new Date(s.semana + 'T00:00:00');
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(fimSemana.getDate() + 6);
      const data = new Date(dataSelecionada + 'T00:00:00');
      return data >= inicioSemana && data <= fimSemana;
    })()
  );

  const policiaisfiltrados = secaoFiltro === 'todas' ? policiais : policiais.filter(p => p.secao === secaoFiltro);

  const deServico = policiaisfiltrados.filter(p => {
    const temFolga = folgasNoDia.find(s => s.policial_id === p.id);
    const afastado = (p.situacao || 'Pronto') !== 'Pronto';
    return !temFolga && !afastado;
  });

  const deFolga = policiaisfiltrados.filter(p => folgasNoDia.find(s => s.policial_id === p.id));

  const afastados = policiaisfiltrados.filter(p => {
    const temFolga = folgasNoDia.find(s => s.policial_id === p.id);
    return !temFolga && (p.situacao || 'Pronto') !== 'Pronto';
  });

  const totalEfetivo = policiaisfiltrados.length;
  const pctServico = totalEfetivo > 0 ? Math.round((deServico.length / totalEfetivo) * 100) : 0;

  return (
    <div>
      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>🪖 Efetivo de Serviço</h3>

      {/* FILTROS */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
        <div>
          <label style={lbl}>Data</label>
          <input type="date" value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Seção</label>
          <select value={secaoFiltro} onChange={e => setSecaoFiltro(e.target.value)} style={inp}>
            <option value="todas">Todas as seções</option>
            {SECOES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* DIA DA SEMANA */}
      <div style={{ background:'linear-gradient(135deg,#0d2340,#1e4d7b)', borderRadius:10, padding:'12px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:'#8db4d8', fontSize:11, fontWeight:600 }}>DIA SELECIONADO</div>
          <div style={{ color:'#fff', fontSize:16, fontWeight:800 }}>{diaSemana}-feira · {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ color:'#8db4d8', fontSize:11, fontWeight:600 }}>DISPONÍVEIS</div>
          <div style={{ color:'#fff', fontSize:22, fontWeight:900 }}>{deServico.length} <span style={{ fontSize:13, fontWeight:400 }}>/ {totalEfetivo}</span></div>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
        <div style={{ background:'#E8F5E9', borderRadius:10, padding:'12px 8px', textAlign:'center', border:'2px solid #A5D6A7' }}>
          <div style={{ fontSize:26, fontWeight:900, color:'#1B5E20' }}>{deServico.length}</div>
          <div style={{ fontSize:11, color:'#1B5E20', fontWeight:700 }}>🟢 De Serviço</div>
          <div style={{ fontSize:10, color:'#6b8099', marginTop:2 }}>{pctServico}% do efetivo</div>
        </div>
        <div style={{ background:'#E3F2FD', borderRadius:10, padding:'12px 8px', textAlign:'center', border:'2px solid #90CAF9' }}>
          <div style={{ fontSize:26, fontWeight:900, color:'#0D47A1' }}>{deFolga.length}</div>
          <div style={{ fontSize:11, color:'#0D47A1', fontWeight:700 }}>🌙 De Folga</div>
        </div>
        <div style={{ background:'#FFEBEE', borderRadius:10, padding:'12px 8px', textAlign:'center', border:'2px solid #EF9A9A' }}>
          <div style={{ fontSize:26, fontWeight:900, color:'#B71C1C' }}>{afastados.length}</div>
          <div style={{ fontSize:11, color:'#B71C1C', fontWeight:700 }}>🚨 Afastados</div>
        </div>
      </div>

      {/* DE SERVIÇO */}
      {deServico.length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#1B5E20', marginBottom:10 }}>🟢 De Serviço ({deServico.length})</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {deServico.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#f8fafc', borderRadius:8, border:'1px solid #e0e8f0' }}>
                <div>
                  <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:13 }}>{p.patente} {p.nome}</span>
                  <span style={{ color:'#6b8099', fontSize:11, marginLeft:8 }}>Mat. {p.matricula}</span>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {p.secao && <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{p.secao}</span>}
                  <SSBadge p={p} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* DE FOLGA */}
      {deFolga.length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#0D47A1', marginBottom:10 }}>🌙 De Folga/Concessão ({deFolga.length})</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {deFolga.map(p => {
              const folga = folgasNoDia.find(s => s.policial_id === p.id);
              return (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#f0f6ff', borderRadius:8, border:'1px solid #d0dce8' }}>
                  <div>
                    <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:13 }}>{p.patente} {p.nome}</span>
                    <span style={{ color:'#6b8099', fontSize:11, marginLeft:8 }}>Mat. {p.matricula}</span>
                  </div>
                  <MotivoBadge motivo={folga?.motivo || 'Folga'} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* AFASTADOS */}
      {afastados.length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#B71C1C', marginBottom:10 }}>🚨 Afastados ({afastados.length})</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {afastados.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#fff5f5', borderRadius:8, border:'1px solid #EF9A9A' }}>
                <div>
                  <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:13 }}>{p.patente} {p.nome}</span>
                  <span style={{ color:'#6b8099', fontSize:11, marginLeft:8 }}>Mat. {p.matricula}</span>
                </div>
                <SituacaoBadge situacao={p.situacao || 'Pronto'} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {deServico.length === 0 && deFolga.length === 0 && afastados.length === 0 && (
        <p style={{ color:'#aab', fontSize:13, textAlign:'center', padding:20 }}>Nenhum policial encontrado para os filtros selecionados.</p>
      )}
    </div>
  );
}

// ========== LOGIN DO POLICIAL (v3.0 — Supabase Auth) ==========
// Senha temporária padrão na Fase 2: <matricula>@32bpm. Quando o policial loga
// com a senha temp pela primeira vez, o perfil tem precisa_trocar_senha=true e
// ele é levado pra tela TrocaSenhaObrigatoria antes de qualquer outra coisa.
function LoginPolicial() {
  const [policiais, setPoliciais] = useState([]);
  const [buscaLogin, setBuscaLogin] = useState('');
  const [policialSel, setPolicialSel] = useState(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [entrando, setEntrando] = useState(false);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  // View `policiais` = perfis WHERE role='policial'. GRANT SELECT TO anon
  // garante que isso lê antes do usuário se autenticar.
  useEffect(() => {
    // Usa RPC SECURITY DEFINER que expõe só 5 campos ao anon
    // (sem rg, telefone, email_contato, sit_sanitaria etc.)
    supabase.rpc('policiais_para_login')
      .then(({ data }) => { setPoliciais(data || []); setCarregando(false); });
  }, []);

  const policiaisFiltrados = buscaLogin.length >= 2
    ? policiais.filter(p => p.nome.toLowerCase().includes(buscaLogin.toLowerCase()) || (p.matricula||'').includes(buscaLogin)).slice(0, 8)
    : [];

  function selecionarPolicial(p) { setPolicialSel(p); setBuscaLogin(p.nome); setMostrarSugestoes(false); setErro(''); }

  async function entrar() {
    if (!policialSel) { setErro('Selecione seu nome na lista.'); return; }
    if (!senha) { setErro('Digite sua senha.'); return; }
    setEntrando(true);
    // Email no auth.users foi padronizado em <matricula>@32bpm.local na Fase 2.
    const email = `${policialSel.matricula}@32bpm.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEntrando(false);
    if (error) {
      setErro(`Senha incorreta. Primeiro acesso? Use a senha temporária: ${policialSel.matricula}@32bpm`);
      return;
    }
    // Sucesso — onAuthStateChange no App() carrega o perfil e direciona.
  }

  return (
    <div>
      <p style={{ color:'#6b8099', fontSize:13, fontWeight:400, marginBottom:20, marginTop:0 }}>
        Digite seu nome e selecione na lista.
      </p>
      <label style={lbl}>Nome ou matrícula</label>
      <div style={{ position:'relative', marginBottom:10 }}>
        <input value={buscaLogin} onChange={e => { setBuscaLogin(e.target.value); setPolicialSel(null); setMostrarSugestoes(true); }} onFocus={() => setMostrarSugestoes(true)} onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)} placeholder="Digite seu nome..." style={{ ...inp }} autoComplete="off" />
        {mostrarSugestoes && policiaisFiltrados.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #d0dce8', borderRadius:8, boxShadow:'0 4px 16px #00000020', zIndex:100, maxHeight:240, overflowY:'auto' }}>
            {carregando ? <div style={{ padding:'10px 14px', color:'#aab', fontSize:13 }}>Carregando...</div>
              : policiaisFiltrados.map(p => (
                <div key={p.id} onMouseDown={() => selecionarPolicial(p)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f0f4f8', fontSize:13, color:'#1a3a5c' }} onMouseEnter={e => e.currentTarget.style.background='#f0f6ff'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                  <div style={{ fontWeight:600 }}>{p.patente} {p.nome}</div>
                  <div style={{ fontSize:11, color:'#6b8099' }}>Mat. {p.matricula} — {p.secao||'Sem seção'}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>
      {policialSel && <div style={{ background:'#f0f6ff', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#1a3a5c', fontWeight:600 }}>✅ {policialSel.patente} {policialSel.nome} — Mat. {policialSel.matricula}</div>}
      <label style={lbl}>Senha</label>
      <input type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key==='Enter'&&entrar()} placeholder="••••••" style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:4 }}>{erro}</p>}
      <button onClick={entrar} disabled={entrando} style={{ ...btnPrimary, letterSpacing:0.5, textTransform:'uppercase', fontSize:13, opacity:entrando?0.7:1 }}>{entrando?'Entrando...':'Entrar'}</button>
      <p style={{ color:'#aab', fontSize:11, marginTop:10, textAlign:'center', fontWeight:400 }}>Primeiro acesso? Senha temporária: <strong>matrícula@32bpm</strong> (ex: 67135@32bpm)</p>
    </div>
  );
}

// ========== GRADE DE FOLGAS DA SEÇÃO ==========
// Mostra para o policial, ao escolher uma semana de referência, quais folgas
// já estão marcadas (aprovadas e pendentes) por colegas da mesma seção.
// Ajuda a evitar concentração no mesmo dia.
function GradeFolgasSecao({ folgas, meuId, secao, semana }) {
  // Formata data ISO da semana ("2026-05-18") em "18/05 a 24/05"
  function periodo() {
    const ini = new Date(semana + 'T00:00:00');
    const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return `${fmt(ini)} a ${fmt(fim)}`;
  }

  // Agrupa folgas por dia da semana
  const porDia = {};
  DIAS.forEach(d => { porDia[d] = []; });
  folgas.forEach(f => { if (porDia[f.dia]) porDia[f.dia].push(f); });

  // Ordena cada dia: aprovadas primeiro, depois pendentes; "você" sempre primeiro
  Object.keys(porDia).forEach(d => {
    porDia[d].sort((a, b) => {
      if (a.policial_id === meuId && b.policial_id !== meuId) return -1;
      if (b.policial_id === meuId && a.policial_id !== meuId) return 1;
      if (a.status === 'aprovado' && b.status !== 'aprovado') return -1;
      if (b.status === 'aprovado' && a.status !== 'aprovado') return 1;
      return 0;
    });
  });

  const totalFolgas = folgas.length;

  return (
    <div style={{ background:'#f8fafc', border:'1px solid #e0e8f0', borderRadius:10, padding:'12px', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:6 }}>
        <div style={{ fontSize:11, fontWeight:800, color:'#1a3a5c', textTransform:'uppercase', letterSpacing:0.8 }}>
          👥 Folgas já marcadas na <span style={{ color:'#0D47A1' }}>{secao}</span>
        </div>
        <span style={{ color:'#6b8099', fontSize:11 }}>{periodo()} · {totalFolgas} {totalFolgas === 1 ? 'pedido' : 'pedidos'}</span>
      </div>

      {totalFolgas === 0 ? (
        <p style={{ color:'#94a3b8', fontSize:12, textAlign:'center', margin:'8px 0', fontStyle:'italic' }}>
          Nenhum colega da sua seção pediu folga nessa semana ainda.
        </p>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:4 }}>
          {DIAS.map(d => {
            const itens = porDia[d];
            const isVazio = itens.length === 0;
            return (
              <div key={d} style={{
                background: isVazio ? '#fff' : '#fff',
                border: '1px solid #e0e8f0',
                borderRadius: 8,
                padding: '8px 6px',
                minHeight: 80,
                display:'flex',
                flexDirection:'column',
              }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: isVazio ? '#aab' : '#1a3a5c',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  textAlign: 'center',
                  paddingBottom: 4,
                  marginBottom: 4,
                  borderBottom: '1px solid #f0f4f8',
                }}>
                  {d.substring(0, 3)}
                </div>
                {isVazio ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#d0dce8', fontSize:14 }}>—</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {itens.map(f => {
                      const ehVoce = f.policial_id === meuId;
                      const isPendente = f.status === 'pendente';
                      const motivoCor = f.motivo === 'Concessão' ? '#6A1B9A' : '#0D47A1';
                      const motivoBg = f.motivo === 'Concessão' ? '#F3E5F5' : '#E3F2FD';
                      // Nome compacto: 2 primeiros nomes
                      const nomeCompacto = f.policial_nome.split(' ').slice(0, 2).join(' ');
                      return (
                        <div key={f.id} style={{
                          background: ehVoce ? '#FFF8E1' : motivoBg,
                          border: ehVoce ? '1.5px solid #fbbf24' : `1px solid ${motivoCor}33`,
                          borderRadius: 6,
                          padding: '3px 6px',
                          fontSize: 10,
                          color: motivoCor,
                          fontWeight: 700,
                          opacity: isPendente ? 0.7 : 1,
                          display:'flex',
                          flexDirection:'column',
                          gap:1,
                          lineHeight:1.2,
                        }}>
                          <span style={{ display:'flex', alignItems:'center', gap:3, flexWrap:'wrap' }}>
                            <span>{f.motivo === 'Concessão' ? '🎖️' : '🌙'}</span>
                            <span style={{ color: ehVoce ? '#7B5800' : motivoCor, fontWeight: 800 }}>
                              {ehVoce ? 'Você' : nomeCompacto}
                            </span>
                          </span>
                          {isPendente && (
                            <span style={{ fontSize:9, color:'#7B5800', fontWeight:700 }}>⏳ pendente</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:10, color:'#6b8099', display:'flex', alignItems:'center', gap:3 }}>
          <span>🌙</span><span>Folga</span>
        </span>
        <span style={{ fontSize:10, color:'#6b8099', display:'flex', alignItems:'center', gap:3 }}>
          <span>🎖️</span><span>Concessão</span>
        </span>
        <span style={{ fontSize:10, color:'#6b8099' }}>⏳ pendente</span>
      </div>
    </div>
  );
}

// ========== TELA DE SOLICITAÇÃO (Policial) ==========
// ========== MEU PERFIL (componente compartilhado) ==========
// Tela onde o usuário (policial OU gestor) edita seus próprios dados de contato
// (email pessoal, telefone) e troca de senha. Auto-atendimento — não depende
// de gestor. Dados básicos (nome, matrícula, patente, seção) são read-only
// porque essas mudanças devem passar pelo gestor.
function MeuPerfilCard({ perfil, onPerfilAtualizado }) {
  const [emailContato, setEmailContato] = useState(perfil.email_contato || '');
  const [telefone, setTelefone] = useState(perfil.telefone || '');
  const [msgPerfil, setMsgPerfil] = useState(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [senhaAtualMP, setSenhaAtualMP] = useState('');
  const [novaSenhaMP, setNovaSenhaMP] = useState('');
  const [confirmaSenhaMP, setConfirmaSenhaMP] = useState('');
  const [msgSenhaMP, setMsgSenhaMP] = useState(null);
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  async function salvarDados() {
    setMsgPerfil(null);
    const novoEmail = emailContato.trim();
    const novoTelefone = telefone.trim();
    if (novoEmail && !validarEmail(novoEmail)) { setMsgPerfil({ tipo:'erro', texto:'Email inválido.' }); return; }
    const updates = {};
    if (novoEmail !== (perfil.email_contato || '')) updates.email_contato = novoEmail || null;
    if (novoTelefone !== (perfil.telefone || '')) updates.telefone = novoTelefone || null;
    if (Object.keys(updates).length === 0) { setMsgPerfil({ tipo:'erro', texto:'Nada pra salvar (nenhum campo mudou).' }); return; }
    setSalvandoPerfil(true);
    const { error } = await supabase.from('perfis').update(updates).eq('id', perfil.id);
    setSalvandoPerfil(false);
    if (error) { setMsgPerfil({ tipo:'erro', texto:'Erro ao salvar: ' + error.message }); return; }
    setMsgPerfil({ tipo:'ok', texto:'✅ Dados salvos.' });
    if (onPerfilAtualizado) onPerfilAtualizado({ ...perfil, ...updates });
    setTimeout(() => setMsgPerfil(null), 3000);
  }

  async function trocarSenhaMP() {
    setMsgSenhaMP(null);
    if (!senhaAtualMP) { setMsgSenhaMP({ tipo:'erro', texto:'Informe a senha atual.' }); return; }
    if (novaSenhaMP.length < 6) { setMsgSenhaMP({ tipo:'erro', texto:'Nova senha precisa ter no mínimo 6 caracteres.' }); return; }
    if (novaSenhaMP !== confirmaSenhaMP) { setMsgSenhaMP({ tipo:'erro', texto:'Senhas não coincidem.' }); return; }
    setTrocandoSenha(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) { setMsgSenhaMP({ tipo:'erro', texto:'Sessão expirou. Faça login de novo.' }); setTrocandoSenha(false); return; }
    const { error: errSign } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtualMP });
    if (errSign) { setMsgSenhaMP({ tipo:'erro', texto:'Senha atual incorreta.' }); setTrocandoSenha(false); return; }
    const { error: errUpd } = await supabase.auth.updateUser({ password: novaSenhaMP });
    setTrocandoSenha(false);
    if (errUpd) { setMsgSenhaMP({ tipo:'erro', texto:'Erro ao trocar senha: ' + errUpd.message }); return; }
    setSenhaAtualMP(''); setNovaSenhaMP(''); setConfirmaSenhaMP('');
    setMsgSenhaMP({ tipo:'ok', texto:'✅ Senha alterada com sucesso!' });
    setTimeout(() => setMsgSenhaMP(null), 3000);
  }

  return (
    <>
      <Card>
        <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:10 }}>👤 Meus Dados</h3>
        <div style={{ background:'#f0f4f8', borderRadius:8, padding:'12px 14px', marginBottom:14, fontSize:12, color:'#1a3a5c', lineHeight:1.7 }}>
          <div><strong>Nome:</strong> {perfil.nome}</div>
          <div><strong>Matrícula:</strong> {perfil.matricula}</div>
          {perfil.patente && <div><strong>Patente:</strong> {perfil.patente}</div>}
          {perfil.secao && <div><strong>Seção:</strong> {perfil.secao}</div>}
          {perfil.is_gestor && <div><strong>Gestão:</strong> {perfil.nivel || 'gestor'}{perfil.funcao ? ` — ${perfil.funcao}` : ''}</div>}
          <div style={{ color:'#6b8099', fontSize:11, marginTop:6 }}>Pra alterar nome, matrícula, patente ou seção, fale com o gestor.</div>
        </div>
        <label style={lbl}>Email pessoal (para contato/notificações)</label>
        <input type="email" value={emailContato} onChange={e => setEmailContato(e.target.value)} placeholder="seu.email@exemplo.com" style={{ ...inp, marginBottom:10 }} />
        <label style={lbl}>Telefone (WhatsApp)</label>
        <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-9999" style={{ ...inp, marginBottom:6 }} />
        {msgPerfil && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgPerfil.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgPerfil.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgPerfil.texto}</div>}
        <button onClick={salvarDados} disabled={salvandoPerfil} style={{ ...btnPrimary, opacity:salvandoPerfil?0.7:1 }}>
          {salvandoPerfil ? 'Salvando...' : 'Salvar dados'}
        </button>
      </Card>

      <Card>
        <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:10 }}>🔒 Trocar Senha</h3>
        <label style={lbl}>Senha atual</label>
        <input type="password" value={senhaAtualMP} onChange={e => setSenhaAtualMP(e.target.value)} placeholder="••••" style={{ ...inp, marginBottom:10 }} />
        <label style={lbl}>Nova senha</label>
        <input type="password" value={novaSenhaMP} onChange={e => setNovaSenhaMP(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...inp, marginBottom:10 }} />
        <label style={lbl}>Confirmar nova senha</label>
        <input type="password" value={confirmaSenhaMP} onChange={e => setConfirmaSenhaMP(e.target.value)} placeholder="Repita a nova senha" style={{ ...inp, marginBottom:6 }} />
        {msgSenhaMP && <div style={{ padding:'10px 14px', borderRadius:8, fontWeight:600, marginBottom:6, background:msgSenhaMP.tipo==='ok'?'#E8F5E9':'#FFEBEE', color:msgSenhaMP.tipo==='ok'?'#1B5E20':'#B71C1C' }}>{msgSenhaMP.texto}</div>}
        <button onClick={trocarSenhaMP} disabled={trocandoSenha} style={{ ...btnPrimary, opacity:trocandoSenha?0.7:1 }}>
          {trocandoSenha ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </Card>
    </>
  );
}

function TelaSolicitacao({ usuario }) {
  const [dia, setDia] = useState(null);
  const [semana, setSemana] = useState('');
  const [semanaBase, setSemanaBase] = useState(() => {
    const base = getInicioSemana(new Date());
    const dow = new Date().getDay();
    if (dow === 0 || dow === 6) base.setDate(base.getDate() + 7); // fim de semana -> abre na proxima
    return base;
  });
  const [motivo, setMotivo] = useState('');
  const [email, setEmail] = useState(usuario.email || '');
  const [minhas, setMinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [solicitandoTroca, setSolicitandoTroca] = useState(null);
  const [novoDiaTroca, setNovoDiaTroca] = useState('');
  const [paginaMinhas, setPaginaMinhas] = useState(1);
  const [usuarioLocal, setUsuarioLocal] = useState(usuario); // cópia local que reflete edição inline do email
  const [folgasDaSecao, setFolgasDaSecao] = useState(null); // null = ainda não carregou; [] = carregou e está vazio

  const carregarMinhas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('folgas_solicitacoes').select('*').eq('policial_id', usuario.id).order('created_at', { ascending:false });
    setMinhas(data || []);
    setLoading(false);
  }, [usuario.id]);

  // Carrega folgas da MESMA SEÇÃO do policial para a semana escolhida.
  // Inclui aprovadas e pendentes; ignora recusadas. Mostra também o próprio
  // policial (na grade ele aparece destacado como "você").
  const carregarFolgasDaSecao = useCallback(async (semanaIso) => {
    if (!semanaIso || !usuario.secao || usuario.secao === '—' || usuario.secao === '') {
      setFolgasDaSecao([]);
      return;
    }
    const { data } = await supabase
      .from('folgas_solicitacoes')
      .select('*')
      .eq('secao', usuario.secao)
      .eq('semana', semanaIso)
      .in('status', ['pendente', 'aprovado']);
    setFolgasDaSecao(data || []);
  }, [usuario.secao]);

  useEffect(() => { carregarMinhas(); }, [carregarMinhas]);
  useEffect(() => {
    const interval = setInterval(() => { carregarMinhas(); }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [carregarMinhas]);

  // Recarrega a grade da seção sempre que muda a semana de referência
  useEffect(() => {
    if (semana) carregarFolgasDaSecao(semana);
    else setFolgasDaSecao(null);
  }, [semana, carregarFolgasDaSecao]);

  const naoProto = usuario.situacao && usuario.situacao !== 'Pronto';

  async function enviar() {
    if (naoProto) return;
    if (!dia || !semana || !motivo) { setMsg({ tipo:'erro', texto:'Selecione o tipo, o dia e a data.' }); return; }
    if (!email || !validarEmail(email)) { setMsg({ tipo:'erro', texto:'Informe um email válido (ex: seu@email.com).' }); return; }
    const check = rateLimiterSolicitacao.podeExecutar();
    if (!check.permitido) { setMsg({ tipo:'erro', texto:`Aguarde ${check.proxemaEmMs}s antes de enviar nova solicitação.` }); return; }
    const isCHR = usuario.restricao === 'CHR';
    const jaExiste = minhas.find(s => s.semana === semana && s.motivo === motivo && s.status !== 'recusado');
    if (jaExiste) {
      // CHR pode ter 2 concessões
      if (motivo === 'Concessão' && isCHR) {
        const concessoesSemana = minhas.filter(s => s.semana === semana && s.motivo === 'Concessão' && s.status !== 'recusado');
        if (concessoesSemana.length >= 2) {
          setMsg({ tipo:'erro', texto:'Você já possui 2 concessões solicitadas para esta semana (limite CHR).' });
          return;
        }
      } else {
        setMsg({ tipo:'erro', texto:`Você já possui uma ${motivo} solicitada para esta semana.` });
        return;
      }
    }
    setEnviando(true);
    const { error } = await supabase.from('folgas_solicitacoes').insert({ policial_id:usuario.id, policial_nome:usuario.nome, matricula:usuario.matricula, patente:usuario.patente, secao:usuario.secao||'—', dia, semana, motivo, status:'pendente', email_policial:email });

    // Se o email mudou (ou nunca foi salvo), persiste no cadastro do policial.
    // Falha silenciosa: solicitação já foi enviada, não bloqueia em erro de coluna.
    if (!error && email !== usuarioLocal.email) {
      // Persiste o email de contato direto em `perfis` (sem mexer no auth.users.email,
      // que continua sendo <matricula>@32bpm.local — usado só pra login).
      const { error: errEmail } = await supabase.from('perfis').update({ email_contato: email }).eq('id', usuario.id);
      if (!errEmail) {
        setUsuarioLocal(u => ({ ...u, email }));
      }
    }

    setEnviando(false);
    if (error) { setMsg({ tipo:'erro', texto:'Erro ao enviar.' }); return; }
    setDia(null); setSemana(''); setMotivo('');
    // NÃO limpo o email — fica pré-preenchido para a próxima
    setMsg({ tipo:'ok', texto:'✅ Solicitação enviada com sucesso!' });
    setTimeout(() => setMsg(null), 4000);
    carregarMinhas();
    if (semana) carregarFolgasDaSecao(semana);
  }

  async function cancelarSolicitacao(id) {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    await supabase.from('folgas_solicitacoes').delete().eq('id', id);
    setMinhas(prev => prev.filter(s => s.id !== id));
  }

  async function enviarTroca(sol) {
    if (!novoDiaTroca) { setMsg({ tipo:'erro', texto:'Selecione o novo dia.' }); return; }
    if (novoDiaTroca === sol.dia) { setMsg({ tipo:'erro', texto:'O novo dia deve ser diferente do atual.' }); return; }
    await supabase.from('folgas_solicitacoes').update({ dia_troca:novoDiaTroca, status_troca:'pendente' }).eq('id', sol.id);
    setMinhas(prev => prev.map(s => s.id === sol.id ? { ...s, dia_troca:novoDiaTroca, status_troca:'pendente' } : s));
    setSolicitandoTroca(null); setNovoDiaTroca('');
    setMsg({ tipo:'ok', texto:'⏳ Solicitação de troca enviada! Aguarde aprovação.' });
    setTimeout(() => setMsg(null), 4000);
  }

  async function cancelarTroca(id) {
    await supabase.from('folgas_solicitacoes').update({ dia_troca:'', status_troca:'' }).eq('id', id);
    setMinhas(prev => prev.map(s => s.id === id ? { ...s, dia_troca:'', status_troca:'' } : s));
  }

  const paginado = paginar(minhas, paginaMinhas, POR_PAGINA);

  // --- Seletor unificado de semana + dia ---
  const hojeZero = new Date(); hojeZero.setHours(0,0,0,0);
  const semanaBaseIso = semanaBase.toISOString().split('T')[0];
  const semanaAtualIso = getInicioSemana(hojeZero).toISOString().split('T')[0];
  const podeVoltar = semanaBaseIso > semanaAtualIso;
  const diasSemana = DIAS.map((nome, i) => {
    const d = new Date(semanaBase); d.setDate(d.getDate() + i); d.setHours(0,0,0,0);
    return { nome, abbr: nome.slice(0,3), dataNum: d.getDate(), passado: d < hojeZero };
  });
  function voltarSemana() { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(d); }
  function avancarSemana() { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(d); }
  const diaEscolhidoLabel = (semana && dia) ? (() => {
    const d = new Date(semana + 'T00:00:00'); d.setDate(d.getDate() + DIAS.indexOf(dia));
    return d.toLocaleDateString('pt-BR');
  })() : '';

  return (
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, color:'#1a3a5c', marginBottom:4 }}>Nova Solicitação</h2>
      <Card>
        <DetalhesPolicialCard policial={usuario} />
        <ContadorFolgas solicitacoes={minhas} policialId={usuario.id} />
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
            <label style={lbl}>Semana e dia da folga *</label>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0f4f8', borderRadius:10, padding:'8px 12px', marginBottom:8 }}>
              <button onClick={voltarSemana} disabled={!podeVoltar} style={{ ...btnSm, background:podeVoltar?'#fff':'#e2e8f0', color:podeVoltar?'#1a3a5c':'#94a3b8', cursor:podeVoltar?'pointer':'not-allowed' }}>← Anterior</button>
              <span style={{ fontWeight:800, color:'#1a3a5c', fontSize:13 }}>📅 {formatarSemana(semanaBase)}</span>
              <button onClick={avancarSemana} style={{ ...btnSm, background:'#fff', color:'#1a3a5c' }}>Próxima →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:8 }}>
              {diasSemana.map(ds => {
                const sel = semana === semanaBaseIso && dia === ds.nome;
                return (
                  <button key={ds.nome} disabled={ds.passado} onClick={() => { setSemana(semanaBaseIso); setDia(ds.nome); }}
                    style={{ padding:'10px 4px', borderRadius:10, cursor:ds.passado?'not-allowed':'pointer', textAlign:'center',
                      background:ds.passado?'#f1f5f9':(sel?'#1a3a5c':'#fff'), color:ds.passado?'#cbd5e1':(sel?'#fff':'#2d4a63'),
                      border:sel?'2px solid #1a3a5c':'2px solid #e2e8f0', opacity:ds.passado?0.6:1 }}>
                    <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{ds.abbr}</div>
                    <div style={{ fontSize:18, fontWeight:900, marginTop:2 }}>{ds.dataNum}</div>
                  </button>
                );
              })}
            </div>
            {semana && dia
              ? <div style={{ background:'#E8F5E9', color:'#1B5E20', borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:700, marginBottom:14 }}>✓ {dia}, {diaEscolhidoLabel}</div>
              : <div style={{ color:'#94a3b8', fontSize:12, marginBottom:14 }}>Escolha o dia da folga acima.</div>}

            {/* Grade de folgas já marcadas na seção, na semana escolhida.
                Não aparece se o policial não tem seção definida. */}
            {semana && folgasDaSecao !== null && usuario.secao && usuario.secao !== '—' && usuario.secao !== '' && (
              <GradeFolgasSecao
                folgas={folgasDaSecao}
                meuId={usuario.id}
                secao={usuario.secao}
                semana={semana}
              />
            )}

            <label style={lbl}>Seu email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.email@gmail.com" style={{ ...inp, marginBottom:4 }} />
            {usuarioLocal.email && email === usuarioLocal.email && (
              <p style={{ color:'#1B5E20', fontSize:11, marginBottom:6, fontWeight:600 }}>✓ Email salvo no seu cadastro</p>
            )}
            {usuarioLocal.email && email !== usuarioLocal.email && email && (
              <p style={{ color:'#7B5800', fontSize:11, marginBottom:6, fontWeight:600 }}>ℹ Email diferente do cadastrado — será atualizado ao enviar</p>
            )}
            {!usuarioLocal.email && (
              <p style={{ color:'#6b8099', fontSize:11, marginBottom:6 }}>Será salvo no seu cadastro para próximas solicitações</p>
            )}
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
                {s.status === 'recusado' && s.motivo_recusa && <div style={{ background:'#FFEBEE', borderRadius:8, padding:'6px 10px', marginTop:8, fontSize:12, color:'#B71C1C', fontWeight:700 }}>✘ Motivo da recusa: {s.motivo_recusa}</div>}
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

      <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', margin:'22px 0 10px' }}>👤 Meu Perfil</h3>
      <MeuPerfilCard
        perfil={usuarioLocal}
        onPerfilAtualizado={(novo) => setUsuarioLocal(prev => ({ ...prev, ...novo }))}
      />
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
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroStatusTocado, setFiltroStatusTocado] = useState(false);
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
  const [novoGestorEmail, setNovoGestorEmail] = useState('');
  const [novoGestorFuncao, setNovoGestorFuncao] = useState('');
  const [novoGestorNivel, setNovoGestorNivel] = useState('gestor');
  const [msgGestor, setMsgGestor] = useState(null);
  // Fase 3: cadastro de gestor com 2 modos
  const [modoCadastroGestor, setModoCadastroGestor] = useState('promover'); // 'promover' | 'novo'
  const [policialParaPromover, setPolicialParaPromover] = useState(null);
  const [buscaPolicialPromover, setBuscaPolicialPromover] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [paginaEfetivo, setPaginaEfetivo] = useState(1);
  const [toast, setToast] = useState(null);
  const [minPorSecao, setMinPorSecao] = useState({});      // { secao: min_prontos } — cobertura mínima
  const [mostrarConfigCob, setMostrarConfigCob] = useState(false);
  const [selecionadas, setSelecionadas] = useState([]);    // ids p/ ações em lote
  const [recusandoId, setRecusandoId] = useState(null);    // id em recusa (mostra campo de motivo)
  const [motivoRecusaTxt, setMotivoRecusaTxt] = useState('');
  const intervalRef = useRef(null);

  const carregar = useCallback(async () => {
    const [s, p, g, c] = await Promise.all([
      supabase.from('folgas_solicitacoes').select('*').order('created_at', { ascending:false }),
      supabase.from('policiais').select('*').order('nome'),
      supabase.from('gestores').select('*').order('created_at'),
      supabase.from('folgas_config_secao').select('*'),
    ]);
    setSolicitacoes(s.data || []);
    setPoliciais(p.data || []);
    setGestores(g.data || []);
    const mp = {}; (c.data || []).forEach(r => { mp[r.secao] = r.min_prontos; }); setMinPorSecao(mp);
    setUltimaAtualizacao(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    carregar();
    intervalRef.current = setInterval(() => { carregar(); }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [carregar]);

  // Auto-default: se a aba abriu em "Pendentes" mas não há pendentes na semana,
  // pula para "Aprovados" automaticamente. Só faz isso uma vez por troca de semana,
  // e respeita escolha manual do gestor (filtroStatusTocado).
  useEffect(() => {
    if (filtroStatusTocado) return;
    if (loading) return;
    const inicio = semanaAtual.toISOString().split('T')[0];
    const fim = new Date(semanaAtual); fim.setDate(fim.getDate() + 6);
    const fimIso = fim.toISOString().split('T')[0];
    const pendentesSemana = solicitacoes.filter(s =>
      s.semana >= inicio && s.semana <= fimIso && s.status === 'pendente'
    ).length;
    if (filtroStatus === 'pendente' && pendentesSemana === 0) {
      setFiltroStatus('aprovado');
    }
  }, [loading, semanaAtual, solicitacoes, filtroStatus, filtroStatusTocado]);

  // Reseta "tocado" quando o gestor troca de semana — cada semana ganha seu próprio auto-default
  useEffect(() => {
    setFiltroStatusTocado(false);
    setFiltroStatus('pendente');
  }, [semanaAtual]);

  // Limpa a seleção em lote / recusa em andamento quando muda o recorte da lista
  useEffect(() => { setSelecionadas([]); setRecusandoId(null); setMotivoRecusaTxt(''); }, [semanaAtual, filtroStatus, filtroSecao, filtroDia, filtroMotivo]);

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
  const pendentesFiltradas = filtradas.filter(s => s.status === 'pendente');

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

  function showToast(texto, tipo = 'ok') {
    setToast({ texto, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  // Aplica a mudança no banco (RPC) + estado + email + histórico. SEM rate limiter
  // (pra poder rodar em loop nas ações em lote). Retorna true se deu certo.
  async function aplicarStatus(id, status, solDireta, motivo) {
    const motivoRec = (status === 'recusado') ? (motivo || null) : null;
    const { error: updErr } = await supabase.rpc('atualizar_status_solicitacao', { p_id: id, p_status: status, p_motivo: motivoRec });
    if (updErr) { showToast(`Erro: ${updErr.message}`, 'erro'); return false; }
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status, motivo_recusa: motivoRec } : s));
    const sol = solDireta || solicitacoes.find(s => s.id === id);
    if (sol && sol.email_policial && status !== 'pendente') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { email:sol.email_policial, nome:sol.policial_nome, motivo:sol.motivo, dia:sol.dia, semana:sol.semana, status:status==='aprovado'?'✅ APROVADA':'❌ RECUSADA', secao:sol.secao, matricula:sol.matricula, motivo_recusa: motivoRec || '' });
    }
    registrarHistorico(supabase, 'solicitacoes', 'mudança_status', { id, status }, gestorLogado.id, gestorLogado.nome);
    return true;
  }

  async function mudarStatus(id, status) {
    if (!isMaster) return;
    const check = rateLimiterAprovacao.podeExecutar();
    if (!check.permitido) { showToast(`Aguarde ${check.proxemaEmMs}s antes de fazer nova aprovação`, 'erro'); return; }
    const ok = await aplicarStatus(id, status);
    if (ok) showToast(status === 'aprovado' ? '✅ Solicitação aprovada!' : '❌ Solicitação recusada!', status === 'aprovado' ? 'ok' : 'erro');
  }

  // Quantos prontos da seção ficam presentes naquele dia/semana.
  // contarEsta=true desconta também a solicitação que está sendo avaliada.
  function calcularCobertura(secao, semana, dia, contarEsta) {
    if (!secao || secao === '—' || secao === '') return null;
    const totalProntos = policiais.filter(p => p.secao === secao && (p.situacao || 'Pronto') === 'Pronto').length;
    const jaDeFolga = solicitacoes.filter(s => s.secao === secao && s.semana === semana && s.dia === dia && s.status === 'aprovado').length;
    const presentes = totalProntos - jaDeFolga - (contarEsta ? 1 : 0);
    const min = minPorSecao[secao] ?? 0;
    return { totalProntos, jaDeFolga, presentes, min, critico: min > 0 && presentes < min };
  }

  // Aprova uma única, avisando+confirmando se estourar a cobertura mínima.
  async function aprovarUma(s) {
    if (!isMaster) return;
    const cob = calcularCobertura(s.secao, s.semana, s.dia, true);
    if (cob && cob.critico) {
      const ok = window.confirm(`⚠️ Aprovar deixa a seção ${s.secao} com apenas ${cob.presentes} prontos na ${s.dia} (mínimo ${cob.min}).\n\nAprovar mesmo assim?`);
      if (!ok) return;
    }
    await mudarStatus(s.id, 'aprovado');
  }

  // Confirma a recusa com o motivo digitado no campo inline.
  async function confirmarRecusa(s) {
    if (!isMaster) return;
    const check = rateLimiterAprovacao.podeExecutar();
    if (!check.permitido) { showToast(`Aguarde ${check.proxemaEmMs}s antes de fazer nova ação`, 'erro'); return; }
    const ok = await aplicarStatus(s.id, 'recusado', s, motivoRecusaTxt.trim());
    if (ok) showToast('❌ Solicitação recusada!', 'erro');
    setRecusandoId(null); setMotivoRecusaTxt('');
  }

  function toggleSelecao(id) {
    setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function selecionarTodasPendentes() {
    const ids = pendentesFiltradas.map(s => s.id);
    const todas = ids.length > 0 && ids.every(id => selecionadas.includes(id));
    setSelecionadas(todas ? [] : ids);
  }
  async function aprovarSelecionadas() {
    if (!isMaster) return;
    const alvos = pendentesFiltradas.filter(s => selecionadas.includes(s.id));
    if (alvos.length === 0) return;
    const criticas = alvos.filter(s => { const c = calcularCobertura(s.secao, s.semana, s.dia, true); return c && c.critico; });
    let aviso = `Aprovar ${alvos.length} solicitação(ões) selecionada(s)?`;
    if (criticas.length > 0) aviso += `\n\n⚠️ ${criticas.length} delas deixaria(m) a seção abaixo do mínimo de cobertura.`;
    if (!window.confirm(aviso)) return;
    for (const s of alvos) { await aplicarStatus(s.id, 'aprovado', s); }
    showToast(`✅ ${alvos.length} aprovada(s)!`);
    setSelecionadas([]);
  }
  async function recusarSelecionadas() {
    if (!isMaster) return;
    const alvos = pendentesFiltradas.filter(s => selecionadas.includes(s.id));
    if (alvos.length === 0) return;
    const motivo = window.prompt(`Recusar ${alvos.length} solicitação(ões)? Informe o motivo (opcional, vale pra todas):`, '');
    if (motivo === null) return; // cancelou
    for (const s of alvos) { await aplicarStatus(s.id, 'recusado', s, motivo.trim()); }
    showToast(`❌ ${alvos.length} recusada(s).`, 'erro');
    setSelecionadas([]);
  }

  async function salvarMinSecao(secao, valor) {
    const n = parseInt(valor, 10);
    const min = (isNaN(n) || n < 0) ? 0 : n;
    setMinPorSecao(prev => ({ ...prev, [secao]: min }));
    const { error } = await supabase.from('folgas_config_secao').upsert({ secao, min_prontos: min });
    if (error) showToast('Erro ao salvar mínimo da seção.', 'erro');
  }

  async function aprovarTroca(sol) {
    if (!isMaster) return;
    // #6 — cobertura no dia NOVO da troca (a folga migra pra esse dia)
    const cob = calcularCobertura(sol.secao, sol.semana, sol.dia_troca, true);
    if (cob && cob.critico) {
      const ok = window.confirm(`⚠️ Aprovar a troca para ${sol.dia_troca} deixa a seção ${sol.secao} com apenas ${cob.presentes} prontos nesse dia (mínimo ${cob.min}).\n\nAprovar mesmo assim?`);
      if (!ok) return;
    }
    await supabase.from('folgas_solicitacoes').update({ dia:sol.dia_troca, status_troca:'aprovado' }).eq('id', sol.id);
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, dia:sol.dia_troca, status_troca:'aprovado' } : s));
    showToast('✅ Troca aprovada!');
  }

  async function recusarTroca(id) {
    if (!isMaster) return;
    await supabase.from('folgas_solicitacoes').update({ status_troca:'recusado' }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status_troca:'recusado' } : s));
    showToast('❌ Troca recusada.', 'erro');
  }

  async function excluirSolicitacao(id) {
    if (!window.confirm('Excluir esta solicitação?')) return;
    await supabase.from('folgas_solicitacoes').delete().eq('id', id);
    setSolicitacoes(prev => prev.filter(s => s.id !== id));
  }

  // Helper: chama a Edge Function admin-users e devolve a mensagem REAL do erro
  // (em vez do genérico "non-2xx status code" que o supabase-js retorna).
  async function chamarAdminUsers(action, payload) {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action, payload },
    });
    if (error) {
      // Tenta extrair a mensagem do body de resposta do servidor
      let msg = error.message || 'Erro na Edge Function';
      try {
        const ctx = await error.context?.json?.();
        if (ctx?.error) msg = ctx.error;
      } catch (_) {}
      return { ok: false, error: msg };
    }
    if (data?.ok === false) return { ok: false, error: data.error || 'Erro' };
    return { ok: true, data };
  }

  async function resetarSenhaPolicial(id, nome, matricula) {
    if (!window.confirm(`Resetar a senha de ${nome} para a temporária (${matricula}@32bpm)?`)) return;
    const r = await chamarAdminUsers('reset-senha-policial', { perfil_id: id });
    if (!r.ok) { showToast(`Erro: ${r.error}`, 'erro'); return; }
    const data = r.data;
    setPoliciais(prev => prev.map(p => p.id === id ? { ...p, precisa_trocar_senha: true } : p));
    showToast(`🔑 Senha de ${nome} resetada para ${data.senha_temporaria}`);
    // Aviso adicional persistente — gestor precisa anotar/avisar o policial
    window.alert(`Senha temporária de ${nome}:\n\n   ${data.senha_temporaria}\n\nPasse essa senha pro policial. Ele será obrigado a trocar no próximo login.`);
  }

  async function atualizarPolicial(id, campo, valor) {
    // Anti-duplicata: se a edição é de matrícula, garante que não existe outra igual
    if (campo === 'matricula') {
      const v = String(valor||'').trim();
      if (!validarMatricula(v)) { showToast('Matrícula inválida', 'erro'); return false; }
      const conflito = policiais.find(p => p.id !== id && p.matricula === v);
      if (conflito) { showToast(`Matrícula ${v} já pertence a ${conflito.nome}`, 'erro'); return false; }
    }
    // View `policiais` é read-only — UPDATE direto em `perfis`.
    const { error } = await supabase.from('perfis').update({ [campo]:valor }).eq('id', id);
    if (error) { showToast('Erro ao salvar', 'erro'); return false; }
    setPoliciais(prev => prev.map(p => p.id === id ? { ...p, [campo]:valor } : p));
    return true;
  }

  async function removerPolicial(id) {
    if (!window.confirm('Confirmar remoção?')) return;
    await supabase.from('folgas_solicitacoes').delete().eq('policial_id', id);
    // Deletar o perfil cascateia pro auth.users (FK ON DELETE CASCADE).
    const { error } = await supabase.from('perfis').delete().eq('id', id);
    if (error) {
      showToast('Erro ao remover. Talvez precise excluir pelo dashboard Supabase Auth.', 'erro');
      return;
    }
    setPoliciais(prev => prev.filter(p => p.id !== id));
    setSolicitacoes(prev => prev.filter(s => s.policial_id !== id));
  }

  async function adicionarPolicial() {
    if (!novoNome.trim() || !validarMatricula(novaMatricula) || !novaSecao) {
      showToast('Preencha nome, matrícula e seção', 'erro');
      return;
    }
    const r = await chamarAdminUsers('add-policial', {
      nome: novoNome, matricula: novaMatricula, patente: novaPatente, secao: novaSecao,
    });
    if (!r.ok) { showToast(`Erro: ${r.error}`, 'erro'); return; }
    const data = r.data;
    // Reidrata a lista local (a Edge Function não devolve o perfil completo)
    const { data: novoPerfil } = await supabase.from('policiais').select('*').eq('id', data.perfil_id).single();
    if (novoPerfil) setPoliciais(prev => [...prev, novoPerfil].sort((a, b) => a.nome.localeCompare(b.nome)));
    showToast(`✅ ${data.nome} adicionado. Senha: ${data.senha_temporaria}`);
    window.alert(`Policial cadastrado!\n\nNome: ${data.nome}\nMatrícula: ${data.matricula}\nSenha temporária: ${data.senha_temporaria}\n\nPasse essa senha pro policial — ele será obrigado a trocar no primeiro login.`);
    setNovoNome(''); setNovaMatricula(''); setNovaPatente('3º SGT PM'); setNovaSecao('');
  }

  async function alterarMinhaSenha() {
    setMsgSenha(null);
    if (!senhaAtual) { setMsgSenha({ tipo:'erro', texto:'Informe a senha atual.' }); return; }
    if (novaSenha.length < 6) { setMsgSenha({ tipo:'erro', texto:'Nova senha precisa ter no mínimo 6 caracteres.' }); return; }
    if (novaSenha !== confirmaSenha) { setMsgSenha({ tipo:'erro', texto:'Senhas não coincidem.' }); return; }
    // Valida senha atual re-logando (auth.users garante bcrypt).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) { setMsgSenha({ tipo:'erro', texto:'Sessão expirou. Faça login de novo.' }); return; }
    const { error: errSign } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaAtual });
    if (errSign) { setMsgSenha({ tipo:'erro', texto:'Senha atual incorreta.' }); return; }
    const { error: errUpd } = await supabase.auth.updateUser({ password: novaSenha });
    if (errUpd) { setMsgSenha({ tipo:'erro', texto:'Erro ao trocar senha: ' + errUpd.message }); return; }
    setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('');
    setMsgSenha({ tipo:'ok', texto:'Senha alterada!' });
    setTimeout(() => setMsgSenha(null), 3000);
  }

  async function adicionarGestor() {
    if (!novoGestorNome.trim()) { setMsgGestor({ tipo:'erro', texto:'Nome obrigatório.' }); return; }
    if (!validarMatricula(novoGestorMatricula)) { setMsgGestor({ tipo:'erro', texto:'Matrícula inválida.' }); return; }
    if (!validarEmail(novoGestorEmail)) { setMsgGestor({ tipo:'erro', texto:'Email inválido.' }); return; }
    const r = await chamarAdminUsers('add-gestor', {
      nome: novoGestorNome,
      matricula: novoGestorMatricula,
      email: novoGestorEmail,
      funcao: novoGestorFuncao,
      nivel: novoGestorNivel,
    });
    if (!r.ok) { setMsgGestor({ tipo:'erro', texto:`Erro: ${r.error}` }); return; }
    const data = r.data;
    const { data: novoG } = await supabase.from('gestores').select('*').eq('id', data.perfil_id).single();
    if (novoG) setGestores(prev => [...prev, novoG]);
    setNovoGestorNome(''); setNovoGestorMatricula(''); setNovoGestorEmail(''); setNovoGestorFuncao(''); setNovoGestorNivel('gestor');
    setMsgGestor({ tipo:'ok', texto:`✅ ${data.nome} cadastrado. Senha temporária: ${data.senha_temporaria}` });
    window.alert(`Gestor cadastrado!\n\nNome: ${data.nome}\nEmail: ${data.email}\nSenha temporária: ${data.senha_temporaria}\n\nPasse essas credenciais pro gestor — ele será obrigado a trocar a senha no primeiro login.`);
    setTimeout(() => setMsgGestor(null), 8000);
  }

  async function promoverPolicialAGestor() {
    setMsgGestor(null);
    if (!policialParaPromover) { setMsgGestor({ tipo:'erro', texto:'Selecione um policial pra promover.' }); return; }
    if (!validarEmail(novoGestorEmail)) { setMsgGestor({ tipo:'erro', texto:'Email pessoal inválido.' }); return; }
    const r = await chamarAdminUsers('promover-policial-a-gestor', {
      perfil_id: policialParaPromover.id,
      email_contato: novoGestorEmail,
      funcao: novoGestorFuncao,
      nivel: novoGestorNivel,
    });
    if (!r.ok) { setMsgGestor({ tipo:'erro', texto:`Erro: ${r.error}` }); return; }
    const { data: novoG } = await supabase.from('gestores').select('*').eq('id', policialParaPromover.id).single();
    if (novoG) setGestores(prev => [...prev.filter(g => g.id !== novoG.id), novoG]);
    const nomePromovido = policialParaPromover.nome;
    setPolicialParaPromover(null); setBuscaPolicialPromover('');
    setNovoGestorEmail(''); setNovoGestorFuncao(''); setNovoGestorNivel('gestor');
    setMsgGestor({ tipo:'ok', texto:`✅ ${nomePromovido} promovido(a) a gestor. Continua no efetivo como policial.` });
    setTimeout(() => setMsgGestor(null), 8000);
  }

  async function rebaixarGestor(id, nome) {
    if (!window.confirm(`Rebaixar ${nome} de gestor?\n\nEle(a) volta a ser apenas policial do efetivo (perde permissões de gestão).`)) return;
    const r = await chamarAdminUsers('rebaixar-gestor', { perfil_id: id });
    if (!r.ok) { showToast(`Erro: ${r.error}`, 'erro'); return; }
    setGestores(prev => prev.filter(g => g.id !== id));
    showToast(`${nome} voltou a ser apenas policial.`);
  }

  async function alterarNivelGestor(id, nivel) {
    await supabase.from('perfis').update({ nivel }).eq('id', id);
    setGestores(prev => prev.map(g => g.id === id ? { ...g, nivel } : g));
  }

  async function alterarFuncaoGestor(id, funcao) {
    await supabase.from('perfis').update({ funcao }).eq('id', id);
    setGestores(prev => prev.map(g => g.id === id ? { ...g, funcao } : g));
  }

  async function removerGestor(id) {
    if (!window.confirm('Remover este gestor?')) return;
    const { error } = await supabase.from('perfis').delete().eq('id', id);
    if (error) {
      showToast('Erro ao remover. Talvez precise excluir pelo dashboard Supabase Auth.', 'erro');
      return;
    }
    setGestores(prev => prev.filter(g => g.id !== id));
  }

  async function resetarSenhaGestor(id, nome, matricula) {
    if (!window.confirm(`Resetar a senha de ${nome} para a temporária (${matricula}@32bpm)?`)) return;
    const r = await chamarAdminUsers('reset-senha-gestor', { perfil_id: id });
    if (!r.ok) { showToast(`Erro: ${r.error}`, 'erro'); return; }
    const data = r.data;
    setGestores(prev => prev.map(g => g.id === id ? { ...g, precisa_trocar_senha: true } : g));
    showToast(`🔑 Senha de ${nome} resetada para ${data.senha_temporaria}`);
    window.alert(`Senha temporária de ${nome}:\n\n   ${data.senha_temporaria}\n\nPasse essa senha pro gestor. Ele será obrigado a trocar no próximo login.`);
  }

  const ABAS = [
    { id:'solicitacoes', label:'📋 Solicitações' },
    { id:'trocas', label:`🔄 Trocas${trocasPendentes.length > 0 ? ` (${trocasPendentes.length})` : ''}` },
    { id:'calendario', label:'📅 Calendário' },
    { id:'servico', label:'🪖 Serviço' },
    { id:'estatisticas', label:'📈 Estatísticas' },
    { id:'efetivo', label:'👮 Efetivo' },
    { id:'gestores', label:'🗝️ Gestores' },
    { id:'meu-perfil', label:'👤 Meu Perfil' },
  ];

  if (loading) return <Spinner />;

  return (
    <div>
      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:toast.tipo==='ok'?'#1B5E20':'#B71C1C', color:'#fff', borderRadius:10, padding:'12px 20px', fontWeight:800, fontSize:14, boxShadow:'0 4px 20px #00000030' }}>
          {toast.texto}
        </div>
      )}

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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
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

          {/* Config: cobertura mínima por seção */}
          {isMaster && (
            <div style={{ marginBottom:14 }}>
              <button onClick={() => setMostrarConfigCob(v => !v)} style={{ ...btnSm, background:'#f0f4f8', color:'#1a3a5c' }}>⚙️ Cobertura mínima por seção {mostrarConfigCob ? '▲' : '▼'}</button>
              {mostrarConfigCob && (
                <div style={{ background:'#fff', borderRadius:10, padding:12, marginTop:8, boxShadow:'0 2px 8px #00000012' }}>
                  <p style={{ color:'#6b8099', fontSize:12, marginBottom:10 }}>Mínimo de policiais <strong>prontos</strong> que devem permanecer em cada seção por dia. <strong>0 = sem alerta.</strong> Salva automaticamente.</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:8 }}>
                    {SECOES.map(sec => (
                      <div key={sec} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, background:'#f8fafc', borderRadius:8, padding:'6px 10px' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#2d4a63' }}>{sec}</span>
                        <input type="number" min="0" defaultValue={minPorSecao[sec] ?? 0} onBlur={e => salvarMinSecao(sec, e.target.value)} style={{ width:54, padding:'4px 6px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13, textAlign:'center', color:'#0f172a' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-abas de status — Pendentes / Aprovados / Todos */}
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
            {[
              { id:'pendente', label:'Pendentes', count: stats.pendentes, color:'#7B5800' },
              { id:'aprovado', label:'Aprovados', count: stats.aprovadas, color:'#1B5E20' },
              { id:'todos',    label:'Todos',     count: stats.total,     color:'#1a3a5c' },
            ].map(t => {
              const ativo = filtroStatus === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setFiltroStatus(t.id); setFiltroStatusTocado(true); setPaginaSolicitacoes(1); }}
                  style={{
                    padding:'8px 14px',
                    borderRadius:8,
                    fontWeight:700,
                    cursor:'pointer',
                    background: ativo ? t.color : '#f0f4f8',
                    color: ativo ? '#fff' : '#2d4a63',
                    border:'none',
                    fontSize:12,
                    display:'inline-flex',
                    alignItems:'center',
                    gap:8,
                  }}
                >
                  <span>{t.label}</span>
                  <span style={{
                    background: ativo ? 'rgba(255,255,255,0.25)' : '#fff',
                    color: ativo ? '#fff' : t.color,
                    fontSize:11,
                    fontWeight:800,
                    padding:'2px 8px',
                    borderRadius:10,
                    minWidth:22,
                    textAlign:'center',
                  }}>{t.count}</span>
                </button>
              );
            })}
            {stats.recusadas > 0 && (
              <button
                onClick={() => { setFiltroStatus('recusado'); setFiltroStatusTocado(true); setPaginaSolicitacoes(1); }}
                style={{
                  padding:'8px 14px',
                  borderRadius:8,
                  fontWeight:700,
                  cursor:'pointer',
                  background: filtroStatus==='recusado' ? '#B71C1C' : '#f0f4f8',
                  color: filtroStatus==='recusado' ? '#fff' : '#2d4a63',
                  border:'none',
                  fontSize:12,
                  display:'inline-flex',
                  alignItems:'center',
                  gap:8,
                }}
              >
                <span>Recusados</span>
                <span style={{
                  background: filtroStatus==='recusado' ? 'rgba(255,255,255,0.25)' : '#fff',
                  color: filtroStatus==='recusado' ? '#fff' : '#B71C1C',
                  fontSize:11,
                  fontWeight:800,
                  padding:'2px 8px',
                  borderRadius:10,
                  minWidth:22,
                  textAlign:'center',
                }}>{stats.recusadas}</span>
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
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
          {/* Ações em lote — só nas pendentes */}
          {isMaster && filtroStatus === 'pendente' && pendentesFiltradas.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'#eef4ff', borderRadius:10, padding:'8px 12px', marginBottom:12 }}>
              <button onClick={selecionarTodasPendentes} style={{ ...btnSm, background:'#fff', color:'#1a3a5c' }}>
                {pendentesFiltradas.every(s => selecionadas.includes(s.id)) ? 'Limpar seleção' : 'Selecionar todas'}
              </button>
              <span style={{ fontSize:12, color:'#3d5a9e', fontWeight:700 }}>{selecionadas.length} selecionada(s)</span>
              <div style={{ flex:1 }} />
              <button onClick={aprovarSelecionadas} disabled={selecionadas.length===0} style={{ ...btnSm, background:selecionadas.length?'#1B5E20':'#cdd5df', color:'#fff', cursor:selecionadas.length?'pointer':'not-allowed' }}>✔ Aprovar ({selecionadas.length})</button>
              <button onClick={recusarSelecionadas} disabled={selecionadas.length===0} style={{ ...btnSm, background:selecionadas.length?'#B71C1C':'#cdd5df', color:'#fff', cursor:selecionadas.length?'pointer':'not-allowed' }}>✘ Recusar ({selecionadas.length})</button>
            </div>
          )}
          {paginadasSolic.dados.length === 0
            ? <p style={{ color:'#aab', fontSize:13, textAlign:'center', padding:20 }}>Nenhuma solicitação nesta semana.</p>
            : (
              <>
                {paginadasSolic.dados.map(s => {
                  const policial = policiais.find(p => p.id === s.policial_id);
                  return (
                    <Card key={s.id}>
                      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {isMaster && s.status === 'pendente' && (
                            <input type="checkbox" checked={selecionadas.includes(s.id)} onChange={() => toggleSelecao(s.id)} style={{ width:18, height:18, cursor:'pointer', flexShrink:0 }} />
                          )}
                          <div><span style={{ fontWeight:800, color:'#1a3a5c', fontSize:14 }}>{s.patente} {s.policial_nome}</span><span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>Mat. {s.matricula}</span></div>
                        </div>
                        <Badge status={s.status} />
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'center' }}>
                        <MotivoBadge motivo={s.motivo} />
                        <span style={{ background:'#e8f0fe', color:'#3d5a9e', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>{s.secao&&s.secao!=='—'?s.secao:'Não vinculada'}</span>
                        <span style={{ color:'#2d4a63', fontSize:13 }}>📅 <strong>{s.dia}</strong> — {s.semana}</span>
                      </div>
                      {(() => {
                        const cob = calcularCobertura(s.secao, s.semana, s.dia, s.status !== 'aprovado');
                        if (!cob) return null;
                        const cor = cob.critico ? '#B71C1C' : (cob.min > 0 && cob.presentes === cob.min ? '#E65100' : '#1B5E20');
                        return (
                          <div style={{ marginTop:8, fontSize:12, fontWeight:700, color:cor, background: cob.critico ? '#FFEBEE' : '#f1f5f9', borderRadius:8, padding:'6px 10px' }}>
                            🪖 Cobertura {s.secao} · {s.dia}: <strong>{cob.presentes}</strong> prontos{cob.min > 0 ? ` (mín ${cob.min})` : ''}{s.status !== 'aprovado' ? ' se aprovar' : ''}{cob.critico ? ' ⚠️' : ''}
                          </div>
                        );
                      })()}
                      {/* Contador compacto do policial */}
                      {policial && <ContadorFolgas solicitacoes={solicitacoes} policialId={s.policial_id} compact={true} />}
                      {/* Detalhes do policial */}
                      {policial && (
                        <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, display:'flex', flexWrap:'wrap', gap:12 }}>
                          <div style={{ flex:'1 1 120px' }}><span style={{ color:'#6b8099', fontWeight:700 }}>🏥 Sit. Sanitária:</span><div style={{ color:COR_SS[policial.sit_sanitaria||'Apto A'], fontWeight:800, marginTop:2 }}>{EMOJI_SS[policial.sit_sanitaria||'Apto A']} {policial.sit_sanitaria||'Apto A'}</div></div>
                          <div style={{ flex:'1 1 120px' }}><span style={{ color:'#6b8099', fontWeight:700 }}>📋 Situação:</span><div style={{ color:(policial.situacao||'Pronto')==='Pronto'?'#1B5E20':'#B71C1C', fontWeight:800, marginTop:2 }}>{policial.situacao||'Pronto'}</div></div>
                          <div style={{ flex:'1 1 120px' }}><span style={{ color:'#6b8099', fontWeight:700 }}>⚠️ Restrição:</span><div style={{ color:(policial.restricao||'Sem restrição')==='Sem restrição'?'#1B5E20':'#E65100', fontWeight:800, marginTop:2 }}>{policial.restricao||'Sem restrição'}</div></div>
                          <div style={{ flex:'1 1 120px' }}><span style={{ color:'#6b8099', fontWeight:700 }}>📍 Seção:</span><div style={{ color:'#1a3a5c', fontWeight:800, marginTop:2 }}>{policial.secao||'—'}</div></div>
                        </div>
                      )}
                      {s.status_troca === 'pendente' && <div style={{ background:'#FFF8E1', borderRadius:6, padding:'4px 10px', marginTop:6, fontSize:12, color:'#7B5800', fontWeight:700 }}>⏳ Troca pendente para: <strong>{s.dia_troca}</strong></div>}
                      {s.status_troca === 'aprovado' && <div style={{ background:'#E8F5E9', borderRadius:6, padding:'4px 10px', marginTop:6, fontSize:12, color:'#1B5E20', fontWeight:700 }}>✅ Troca aprovada para: <strong>{s.dia_troca}</strong></div>}
                      {s.status === 'recusado' && s.motivo_recusa && <div style={{ background:'#FFEBEE', borderRadius:6, padding:'4px 10px', marginTop:6, fontSize:12, color:'#B71C1C', fontWeight:700 }}>✘ Motivo: {s.motivo_recusa}</div>}
                      {s.email_policial && <p style={{ color:'#aab', fontSize:12, marginTop:4 }}>📧 {s.email_policial}</p>}
                      <p style={{ color:'#bbb', fontSize:12, marginTop:4 }}>{formatarDataHora(s.created_at)}</p>
                      {isMaster && s.status === 'pendente' && recusandoId !== s.id && (
                        <div style={{ display:'flex', gap:8, marginTop:10 }}>
                          <button onClick={() => aprovarUma(s)} style={{ ...btnSm, background:'#1B5E20', color:'#fff' }}>✔ Aprovar</button>
                          <button onClick={() => { setRecusandoId(s.id); setMotivoRecusaTxt(''); }} style={{ ...btnSm, background:'#B71C1C', color:'#fff' }}>✘ Recusar</button>
                        </div>
                      )}
                      {isMaster && s.status === 'pendente' && recusandoId === s.id && (
                        <div style={{ background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:8, padding:10, marginTop:10 }}>
                          <textarea value={motivoRecusaTxt} onChange={e => setMotivoRecusaTxt(e.target.value)} placeholder="Motivo da recusa (opcional — o policial vai ver)" rows={2} style={{ width:'100%', padding:'8px', borderRadius:6, border:'1.5px solid #d1d5db', fontSize:13, boxSizing:'border-box', resize:'vertical', color:'#0f172a' }} />
                          <div style={{ display:'flex', gap:8, marginTop:8 }}>
                            <button onClick={() => confirmarRecusa(s)} style={{ ...btnSm, background:'#B71C1C', color:'#fff' }}>Confirmar recusa</button>
                            <button onClick={() => { setRecusandoId(null); setMotivoRecusaTxt(''); }} style={{ ...btnSm, background:'#f0f4f8', color:'#2d4a63' }}>Cancelar</button>
                          </div>
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
                {(() => {
                  const cob = calcularCobertura(s.secao, s.semana, s.dia_troca, true);
                  if (!cob) return null;
                  const cor = cob.critico ? '#B71C1C' : (cob.min > 0 && cob.presentes === cob.min ? '#E65100' : '#1B5E20');
                  return (
                    <div style={{ marginTop:8, fontSize:12, fontWeight:700, color:cor, background: cob.critico ? '#FFEBEE' : '#f1f5f9', borderRadius:8, padding:'6px 10px' }}>
                      🪖 Cobertura {s.secao} · {s.dia_troca} (novo dia): <strong>{cob.presentes}</strong> prontos se aprovar{cob.min > 0 ? ` (mín ${cob.min})` : ''}{cob.critico ? ' ⚠️' : ''}
                    </div>
                  );
                })()}
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
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>📅 Calendário de Folgas Aprovadas</h3>
          <CalendarioFolgas solicitacoes={solicitacoes} />
        </Card>
      )}

      {aba === 'servico' && (
        <TelaServico solicitacoes={solicitacoes} policiais={policiais} />
      )}

      {aba === 'estatisticas' && (
        <Dashboard
          solicitacoes={solicitacoes}
          policiais={policiais}
          onAtualizarPolicial={atualizarPolicial}
          onRemoverPolicial={removerPolicial}
          semanaAtual={semanaAtual}
        />
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
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div><label style={lbl}>Nome completo *</label><input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="NOME COMPLETO" style={inp} /></div>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}><label style={lbl}>Matrícula *</label><input value={novaMatricula} onChange={e => setNovaMatricula(e.target.value)} placeholder="99999" style={inp} /></div>
                <div style={{ flex:1 }}><label style={lbl}>Patente</label>
                  <select value={novaPatente} onChange={e => setNovaPatente(e.target.value)} style={inp}>
                    {PATENTES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Seção *</label>
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
                  <div style={{ fontWeight:800, color:'#1a3a5c', fontSize:13, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <EditavelInline
                      valor={p.patente}
                      tipo="select"
                      opcoes={PATENTES}
                      onSalvar={v => atualizarPolicial(p.id, 'patente', v)}
                      inputStyle={{ fontSize:13, fontWeight:800 }}
                    />
                    <span>{p.nome}</span>
                  </div>
                  <div style={{ color:'#6b8099', fontSize:12, marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                    <span>Mat.</span>
                    <EditavelInline
                      valor={p.matricula}
                      onSalvar={v => atualizarPolicial(p.id, 'matricula', String(v).trim())}
                      placeholder="99999"
                      validar={v => (!validarMatricula(String(v||'').trim()) ? 'Matrícula inválida' : null)}
                      inputStyle={{ fontSize:12, fontWeight:600, width:90 }}
                    />
                  </div>
                  {p.email && (
                    <div style={{ color:'#6b8099', fontSize:12, marginTop:2 }}>
                      📧 <span style={{ color:'#3d5a9e' }}>{p.email}</span>
                    </div>
                  )}
                  <ContadorFolgas solicitacoes={solicitacoes} policialId={p.id} compact={true} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8, width:'100%' }}>
                    <div style={{ minWidth:0 }}><label style={{ ...lbl, fontSize:10 }}>Seção</label><select value={p.secao||''} onChange={e => atualizarPolicial(p.id,'secao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}><option value="">— Não definida —</option>{SECOES.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div style={{ minWidth:0 }}><label style={{ ...lbl, fontSize:10 }}>Sit. Sanitária</label><select value={p.sit_sanitaria||'Apto A'} onChange={e => atualizarPolicial(p.id,'sit_sanitaria',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{SIT_SANITARIA_LTS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div style={{ minWidth:0 }}><label style={{ ...lbl, fontSize:10 }}>Situação</label><select value={p.situacao||'Pronto'} onChange={e => atualizarPolicial(p.id,'situacao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{SITUACOES.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div style={{ minWidth:0 }}><label style={{ ...lbl, fontSize:10 }}>Restrições</label><select value={p.restricao||'Sem restrição'} onChange={e => atualizarPolicial(p.id,'restricao',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }}>{RESTRICOES.map(s => <option key={s}>{s}</option>)}</select></div>
                  </div>
                  {p.situacao === 'Férias' && (
                    <div style={{ marginTop:8, background:'#FFF8E1', borderRadius:8, padding:'10px' }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'#E65100', marginBottom:8 }}>🟠 Período de Férias</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:120 }}><label style={{ ...lbl, fontSize:10 }}>Início das Férias</label><input type="date" value={p.ferias_inicio||''} onChange={e => atualizarPolicial(p.id,'ferias_inicio',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                        <div style={{ flex:1, minWidth:120 }}><label style={{ ...lbl, fontSize:10 }}>Fim das Férias</label><input type="date" value={p.ferias_fim||''} onChange={e => atualizarPolicial(p.id,'ferias_fim',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      </div>
                      {p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && (
                        <div style={{ marginTop:6 }}>
                          <span style={{ background:diasParaRetorno(p.ferias_fim)<=3?'#B71C1C':'#1B5E20', color:'#fff', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>
                            {diasParaRetorno(p.ferias_fim)===0?'Retorna hoje!':diasParaRetorno(p.ferias_fim)<0?'Férias vencidas!':diasParaRetorno(p.ferias_fim)<=3?`⚠️ Retorna em ${diasParaRetorno(p.ferias_fim)} dias`:`Retorna em ${diasParaRetorno(p.ferias_fim)} dias`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {(p.sit_sanitaria === 'Apto B' || p.sit_sanitaria === 'Apto C' || p.sit_sanitaria === 'LTS') && (
                    <div style={{ marginTop:8, background: p.sit_sanitaria==='Apto B'?'#FFF8E1':p.sit_sanitaria==='Apto C'?'#FFEBEE':'#F3E5F5', borderRadius:8, padding:'10px' }}>
                      <div style={{ fontSize:11, fontWeight:800, color: p.sit_sanitaria==='Apto B'?'#F9A825':p.sit_sanitaria==='Apto C'?'#B71C1C':'#6A1B9A', marginBottom:8 }}>
                        {p.sit_sanitaria==='Apto B' ? '🟡' : p.sit_sanitaria==='Apto C' ? '🔴' : '🟣'} Período do {p.sit_sanitaria}
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:120 }}><label style={{ ...lbl, fontSize:10 }}>Data de Início</label><input type="date" value={p.ss_inicio||''} onChange={e => atualizarPolicial(p.id,'ss_inicio',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                        <div style={{ flex:1, minWidth:120 }}><label style={{ ...lbl, fontSize:10 }}>Data de Fim</label><input type="date" value={p.ss_fim||''} onChange={e => atualizarPolicial(p.id,'ss_fim',e.target.value)} style={{ ...inp, fontSize:12, padding:'6px 8px' }} /></div>
                      </div>
                      {p.ss_fim && diasParaRetorno(p.ss_fim) !== null && (
                        <div style={{ marginTop:6 }}>
                          <span style={{ background:diasParaRetorno(p.ss_fim)<=3?(p.sit_sanitaria==='Apto B'?'#F9A825':p.sit_sanitaria==='Apto C'?'#B71C1C':'#6A1B9A'):'#1B5E20', color:'#fff', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>
                            {diasParaRetorno(p.ss_fim)===0?'Encerra hoje!':diasParaRetorno(p.ss_fim)<0?`${p.sit_sanitaria} vencido!`:diasParaRetorno(p.ss_fim)<=3?`⚠️ Encerra em ${diasParaRetorno(p.ss_fim)} dias`:`Encerra em ${diasParaRetorno(p.ss_fim)} dias`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                    <SSBadge p={p} /><SituacaoBadge situacao={p.situacao||'Pronto'} />
                    {p.restricao && p.restricao !== 'Sem restrição' && <span style={{ background:'#FFF3E0', color:'#E65100', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:800 }}>{p.restricao}</span>}
                    <button onClick={() => resetarSenhaPolicial(p.id, p.nome, p.matricula)} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800' }}>🔑 Resetar senha</button>
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
              <h3 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:10 }}>➕ Cadastrar Novo Gestor</h3>
              <div style={{ display:'flex', gap:6, marginBottom:14, background:'#f0f4f8', borderRadius:8, padding:4 }}>
                <button onClick={() => { setModoCadastroGestor('promover'); setMsgGestor(null); }} style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:modoCadastroGestor==='promover'?'#1a3a5c':'transparent', color:modoCadastroGestor==='promover'?'#fff':'#6b8099' }}>⬆️ Promover policial existente</button>
                <button onClick={() => { setModoCadastroGestor('novo'); setMsgGestor(null); }} style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:modoCadastroGestor==='novo'?'#1a3a5c':'transparent', color:modoCadastroGestor==='novo'?'#fff':'#6b8099' }}>🆕 Criar gestor novo</button>
              </div>
              {modoCadastroGestor === 'promover' ? (
                <>
                  <p style={{ color:'#6b8099', fontSize:11, marginBottom:10 }}>Use isso quando o gestor já está cadastrado como policial. Ele ganha permissões de gestor mas continua no efetivo recebendo folga.</p>
                  <label style={lbl}>Buscar policial *</label>
                  <div style={{ position:'relative', marginBottom:10 }}>
                    <input value={buscaPolicialPromover} onChange={e => { setBuscaPolicialPromover(e.target.value); setPolicialParaPromover(null); }} placeholder="Digite nome ou matrícula" style={{ ...inp }} autoComplete="off" />
                    {buscaPolicialPromover.length >= 2 && !policialParaPromover && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #d0dce8', borderRadius:8, boxShadow:'0 4px 16px #00000020', zIndex:100, maxHeight:240, overflowY:'auto' }}>
                        {policiais.filter(p => !p.is_gestor && (p.nome.toLowerCase().includes(buscaPolicialPromover.toLowerCase()) || (p.matricula||'').includes(buscaPolicialPromover))).slice(0, 8).map(p => (
                          <div key={p.id} onClick={() => { setPolicialParaPromover(p); setBuscaPolicialPromover(p.nome); }} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f0f4f8', fontSize:13, color:'#1a3a5c' }} onMouseEnter={e => e.currentTarget.style.background='#f0f6ff'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                            <div style={{ fontWeight:600 }}>{p.patente} {p.nome}</div>
                            <div style={{ fontSize:11, color:'#6b8099' }}>Mat. {p.matricula} — {p.secao||'Sem seção'}</div>
                          </div>
                        ))}
                        {policiais.filter(p => !p.is_gestor && (p.nome.toLowerCase().includes(buscaPolicialPromover.toLowerCase()) || (p.matricula||'').includes(buscaPolicialPromover))).length === 0 && (
                          <div style={{ padding:'10px 14px', fontSize:12, color:'#aab' }}>Nenhum policial encontrado (ou já é gestor)</div>
                        )}
                      </div>
                    )}
                  </div>
                  {policialParaPromover && <div style={{ background:'#E8F5E9', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#1B5E20', fontWeight:600 }}>✅ Selecionado: {policialParaPromover.patente} {policialParaPromover.nome} — Mat. {policialParaPromover.matricula}</div>}
                  <label style={lbl}>Email pessoal *</label>
                  <input type="email" value={novoGestorEmail} onChange={e => setNovoGestorEmail(e.target.value)} placeholder="email.do.gestor@exemplo.com" style={{ ...inp, marginBottom:10 }} />
                  <p style={{ color:'#6b8099', fontSize:11, marginTop:-8, marginBottom:10 }}>O policial continua logando com a matrícula. O email pessoal é só pra contato/notificação futura.</p>
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
                  <button onClick={promoverPolicialAGestor} style={btnPrimary}>Promover a Gestor</button>
                </>
              ) : (
                <>
                  <p style={{ color:'#6b8099', fontSize:11, marginBottom:10 }}>Use isso pra cadastrar alguém que é gestor mas NÃO faz parte do efetivo (não recebe folga). Ex: pessoal administrativo, gestor externo.</p>
                  <label style={lbl}>Nome / Patente *</label>
                  <input value={novoGestorNome} onChange={e => setNovoGestorNome(e.target.value)} placeholder="Ex.: TEN CEL SILVA" style={{ ...inp, marginBottom:10 }} />
                  <label style={lbl}>Matrícula *</label>
                  <input value={novoGestorMatricula} onChange={e => setNovoGestorMatricula(e.target.value)} placeholder="Ex.: 80231" style={{ ...inp, marginBottom:10 }} />
                  <label style={lbl}>Email *</label>
                  <input type="email" value={novoGestorEmail} onChange={e => setNovoGestorEmail(e.target.value)} placeholder="email.do.gestor@exemplo.com" style={{ ...inp, marginBottom:10 }} />
                  <p style={{ color:'#6b8099', fontSize:11, marginTop:-8, marginBottom:10 }}>Senha temporária = matrícula@32bpm (ex: 80231@32bpm). Gestor troca no primeiro login.</p>
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
                </>
              )}
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
                  {!g.principal && g.id !== gestorLogado.id && isPrincipal && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <button onClick={() => resetarSenhaGestor(g.id, g.nome, g.matricula)} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800' }}>🔑 Resetar senha</button>
                      {g.role === 'policial' && <button onClick={() => rebaixarGestor(g.id, g.nome)} style={{ ...btnSm, background:'#FFF3E0', color:'#E65100' }}>⬇️ Rebaixar a policial</button>}
                      <button onClick={() => removerGestor(g.id)} style={{ ...btnSm, background:'#FFEBEE', color:'#B71C1C' }}>Remover</button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </>
      )}

      {aba === 'meu-perfil' && (
        <MeuPerfilCard
          perfil={gestores.find(g => g.id === gestorLogado.id) || gestorLogado}
          onPerfilAtualizado={(novo) => setGestores(prev => prev.map(g => g.id === novo.id ? { ...g, ...novo } : g))}
        />
      )}
    </div>
  );
}


// ========== TELA PORTAL — Hub unificado de módulos (Gestor) ==========
const MODULOS_PORTAL = [
  {
    id: 'folgas',
    titulo: 'Controle de Folgas',
    descricao: 'Solicitações, aprovações, escala semanal e relatórios do efetivo.',
    icone: '📅',
    cor: '#fbbf24',
    tipo: 'interno',  // abre dentro do app (TelaGestor)
    destino: 'gestor',
    ativo: true,
  },
  {
    id: 'ajd',
    titulo: 'Procedimentos AJD',
    descricao: 'Averiguações, IPMs, sindicâncias e demais procedimentos administrativos com alerta de prazo.',
    icone: '⚖️',
    cor: '#60a5fa',
    tipo: 'interno',
    destino: 'ajd',
    ativo: true,
  },
  // Espaço reservado para próximos módulos — basta adicionar aqui
  {
    id: 'escala',
    titulo: 'Escala de Serviço',
    descricao: 'Registro e controle de assunção de serviço das guarnições.',
    icone: '🛡️',
    cor: '#34d399',
    tipo: 'externo',
    destino: 'https://32bpm-escaladiaria.vercel.app/sso',
    ativo: true,
  },
  {
    id: 'p3',
    titulo: 'Operações / P-3',
    descricao: 'Em breve — planejamento operacional e empregos.',
    icone: '🎯',
    cor: '#475569',
    tipo: 'futuro',
    destino: null,
    ativo: false,
  },
];

function TelaPortal({ gestor, onSelecionarInterno }) {
  async function abrirModulo(m) {
    if (!m.ativo) return;
    if (m.tipo === 'externo') {
      // SSO bridge: anexa access_token + refresh_token no hash da URL.
      // O app destino (AJD, EscalaDiaria) tem detectSessionInUrl=true no createClient
      // e captura a sessão automaticamente no boot — sem segundo login.
      let url = m.destino;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.access_token && session.refresh_token) {
          const u = new URL(m.destino);
          u.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&token_type=bearer&expires_in=${session.expires_in || 3600}&type=recovery`;
          url = u.toString();
        }
      } catch (e) {
        // Se falhar, abre sem bridge — o destino exige login mas pelo menos abre.
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (m.tipo === 'interno') {
      onSelecionarInterno(m.destino);
    }
  }

  return (
    <div>
      {/* Cabeçalho de boas-vindas */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ width:28, height:1, background:'#1a3a5c' }} />
          <span style={{ color:'#1a3a5c', fontSize:10, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' }}>
            Portal do Comando
          </span>
        </div>
        <h1 style={{ color:'#0f172a', fontWeight:700, fontSize:38, margin:'0 0 6px', fontFamily:"'Rajdhani',sans-serif", lineHeight:1.05 }}>
          Bem-vindo{gestor && gestor.nome ? `, ${gestor.nome.split(' ')[0]}` : ''}
        </h1>
        <p style={{ color:'#64748b', fontSize:14, margin:0 }}>
          Selecione o módulo que deseja acessar. Mais funções serão adicionadas em breve.
        </p>
      </div>

      {/* Grid de módulos */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',
        gap:16,
      }}>
        {MODULOS_PORTAL.map(m => (
          <div
            key={m.id}
            onClick={() => abrirModulo(m)}
            style={{
              background: m.ativo ? '#fff' : '#f8fafc',
              border: `1px solid ${m.ativo ? '#e2e8f0' : '#f1f5f9'}`,
              borderLeft: `3px solid ${m.cor}`,
              borderRadius: 10,
              padding: '20px 18px',
              cursor: m.ativo ? 'pointer' : 'not-allowed',
              opacity: m.ativo ? 1 : 0.55,
              transition: 'all 0.18s ease',
              position: 'relative',
              minHeight: 150,
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseEnter={e => {
              if (!m.ativo) return;
              e.currentTarget.style.background = 'rgba(26,58,92,0.04)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px ${m.cor}33`;
            }}
            onMouseLeave={e => {
              if (!m.ativo) return;
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:28 }}>{m.icone}</span>
              {m.tipo === 'externo' && m.ativo && (
                <span title="Abre em nova aba" style={{
                  color: m.cor, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  background: `${m.cor}1a`, padding: '3px 7px', borderRadius: 4,
                }}>↗ Nova aba</span>
              )}
              {m.tipo === 'futuro' && (
                <span style={{
                  color:'#64748b', fontSize:9, fontWeight:700,
                  letterSpacing:'0.18em', textTransform:'uppercase',
                  background:'rgba(100,116,139,0.12)', padding:'3px 7px', borderRadius:4,
                }}>Em breve</span>
              )}
            </div>
            <div style={{ color:'#0f172a', fontWeight:700, fontSize:17, marginBottom:6, fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.02em' }}>
              {m.titulo}
            </div>
            <div style={{ color:'#475569', fontSize:12.5, lineHeight:1.5, flex:1 }}>
              {m.descricao}
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé do portal */}
      <div style={{
        marginTop: 32,
        paddingTop: 18,
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <span style={{ color:'#475569', fontSize:11, letterSpacing:'0.08em' }}>
          PMERJ · 32º BPM — Sistemas Integrados
        </span>
        <span style={{ color:'#334155', fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>
          v2.2 · Portal
        </span>
      </div>
    </div>
  );
}

// ========== TROCA DE SENHA OBRIGATÓRIA ==========
// Aparece quando perfil.precisa_trocar_senha === true. Não tem jeito de pular.
// Disparado pelo router central no App() default.
function TrocaSenhaObrigatoria({ perfil, onTrocada }) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function trocar() {
    setErro('');
    if (s1.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres.'); return; }
    if (s1 !== s2) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true);
    const { error: errAuth } = await supabase.auth.updateUser({ password: s1 });
    if (errAuth) {
      setSalvando(false);
      setErro('Erro ao trocar senha: ' + errAuth.message);
      return;
    }
    const { error: errPerfil } = await supabase.from('perfis').update({ precisa_trocar_senha: false }).eq('id', perfil.id);
    setSalvando(false);
    if (errPerfil) {
      setErro('Senha trocada mas erro ao atualizar perfil. Saia e entre de novo.');
      return;
    }
    onTrocada();
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '28px 26px', color: '#0f172a' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ width:28, height:1, background:'#1a3a5c' }} />
        <span style={{ color:'#1a3a5c', fontSize:10, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' }}>Primeiro acesso</span>
      </div>
      <h2 style={{ color:'#0f172a', fontWeight:700, fontSize:28, margin:'0 0 8px', fontFamily:"'Rajdhani',sans-serif", lineHeight:1.05 }}>Cadastre uma senha pessoal</h2>
      <p style={{ color:'#64748b', fontSize:13, margin:'0 0 22px' }}>
        Olá, <strong style={{ color:'#0f172a' }}>{perfil.nome}</strong>! Você está usando a senha temporária.
        Para sua segurança, escolha uma nova senha antes de continuar.
      </p>
      <label style={lbl}>Nova senha *</label>
      <input type="password" value={s1} onChange={e => setS1(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ ...inp, marginBottom:10 }} />
      <label style={lbl}>Confirmar nova senha *</label>
      <input type="password" value={s2} onChange={e => setS2(e.target.value)} onKeyDown={e => e.key === 'Enter' && trocar()} placeholder="Repita a senha" style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:'#f87171', fontSize:12, marginBottom:4 }}>{erro}</p>}
      <button onClick={trocar} disabled={salvando} style={{ ...btnPrimary, opacity:salvando?0.7:1 }}>{salvando ? 'Salvando...' : 'Trocar senha e continuar'}</button>
      <p style={{ color:'#475569', fontSize:10, marginTop:14, textAlign:'center', fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase' }}>PMERJ · 32º BPM</p>
    </div>
  );
}

export default function App() {
  // modos possíveis: 'carregando' | 'login' | 'trocaSenha' | 'policial' | 'portal' | 'gestor' | 'ajd'
  const [modo, setModo] = useState('carregando');
  const [usuarioSel, setUsuarioSel] = useState(null);
  const [gestorLogado, setGestorLogado] = useState(null);
  const [sessionAtual, setSessionAtual] = useState(null);
  const currentUserIdRef = useRef(null);
  // Tela de login do gestor agora pede email + senha (em vez de só senha)
  const [emailGestor, setEmailGestor] = useState('');
  const [senhaGestor, setSenhaGestor] = useState('');
  const [erroLoginGestor, setErroLoginGestor] = useState('');
  const [entrandoGestor, setEntrandoGestor] = useState(false);

  // Viewport tracking — split layout fica autônomo via inline styles,
  // não depende do CSS externo ser carregado corretamente.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Carrega o perfil do user autenticado e decide pra qual tela mandar.
  // Chamado no boot (com a session que o supabase-js já restaurou) e a cada
  // mudança no auth state (signin/signout/refresh).
  const carregarPerfilEDirecionar = useCallback(async (user) => {
    if (!user) {
      currentUserIdRef.current = null;
      setUsuarioSel(null);
      setGestorLogado(null);
      setModo('login');
      return;
    }
    const { data: perfil, error } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    if (error || !perfil) {
      // Auth OK mas perfil sumiu — desloga pra não travar.
      await supabase.auth.signOut();
      currentUserIdRef.current = null;
      setUsuarioSel(null);
      setGestorLogado(null);
      setModo('login');
      return;
    }
    // Normaliza email_contato → email pra manter compat com o resto do código
    // (TelaSolicitacao, DetalhesPolicialCard etc esperam `usuario.email`).
    const perfilNormalizado = { ...perfil, email: perfil.email_contato || '' };
    currentUserIdRef.current = user.id;

    if (perfil.precisa_trocar_senha) {
      setUsuarioSel(perfilNormalizado);
      setGestorLogado(perfilNormalizado);
      setModo('trocaSenha');
      return;
    }
    if (perfil.role === 'policial') {
      setUsuarioSel(perfilNormalizado);
      setGestorLogado(null);
      setModo('policial');
      return;
    }
    if (perfil.role === 'gestor' || perfil.role === 'comandante') {
      setUsuarioSel(null);
      setGestorLogado(perfilNormalizado);
      setModo('portal');
      return;
    }
    if (perfil.role === 'admin_ajd' || perfil.role === 'encarregado') {
      // Esses roles não têm tela aqui ainda. Mostra o portal pra eles acessarem
      // o AJD via SSO. Nada de "Controle de Folgas" interno.
      setUsuarioSel(null);
      setGestorLogado(perfilNormalizado);
      setModo('portal');
      return;
    }
    setModo('login');
  }, []);

  // Boot: pega sessão atual + escuta mudanças no auth state.
  useEffect(() => {
    let canceled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (canceled) return;
      setSessionAtual(session || null);
      carregarPerfilEDirecionar(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null;
        setUsuarioSel(null);
        setGestorLogado(null);
        setSessionAtual(null);
        setModo('login');
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        setSessionAtual(session || null);
        // Só o token mudou, usuário é o mesmo — não reseta a tela.
        return;
      }
      if (event === 'SIGNED_IN') {
        setSessionAtual(session || null);
        // Só recarrega o perfil se for um novo login (user ID diferente).
        // Evita reset de tela quando o Supabase re-dispara SIGNED_IN ao
        // voltar de outra janela (Cmd+Tab).
        if (session?.user?.id && session.user.id !== currentUserIdRef.current) {
          carregarPerfilEDirecionar(session?.user || null);
        }
        return;
      }
      if (event === 'USER_UPDATED') {
        setSessionAtual(session || null);
        // USER_UPDATED é intencional (ex: troca de senha) — sempre recarrega.
        carregarPerfilEDirecionar(session?.user || null);
      }
    });
    return () => {
      canceled = true;
      subscription?.unsubscribe();
    };
  }, [carregarPerfilEDirecionar]);

  async function loginGestor() {
    setErroLoginGestor('');
    if (!emailGestor || !senhaGestor) { setErroLoginGestor('Preencha email e senha.'); return; }
    setEntrandoGestor(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailGestor.trim().toLowerCase(),
      password: senhaGestor,
    });
    setEntrandoGestor(false);
    if (error) {
      setErroLoginGestor('Email ou senha incorretos.');
      return;
    }
    // onAuthStateChange leva o resto. Limpa campo de senha por segurança.
    setSenhaGestor('');
  }

  async function sair() {
    await supabase.auth.signOut();
    setEmailGestor('');
    setSenhaGestor('');
    setErroLoginGestor('');
  }
  
  // Re-carrega perfil depois da troca de senha forçada — pra sair do modo
  // 'trocaSenha' e cair na tela certa (policial / portal).
  async function aoTrocarSenha() {
    const { data: { user } } = await supabase.auth.getUser();
    carregarPerfilEDirecionar(user);
  }

  const [abaLogin, setAbaLogin] = useState('policial');

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* CABEÇALHO */}
      <div style={{ background:'#1a3a5c', borderTop:'3px solid #f59e0b', padding:'13px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 4px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:36, width:36, objectFit:'contain', borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.3)' }} />
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:15, letterSpacing:0.5, fontFamily:"'Rajdhani',sans-serif" }}>32º BPM — Controle de Folgas</div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:9, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase' }}>PCSV · Expediente Semanal · v2.2</div>
          </div>
        </div>
        {modo !== 'login' && modo !== 'carregando' && modo !== 'ajd' && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {modo === 'gestor' && gestorLogado && (
              <button
                onClick={() => setModo('portal')}
                title="Voltar ao portal de módulos"
                style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}
              >
                ← Portal
              </button>
            )}
            <button onClick={sair} style={{ background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>← Sair</button>
          </div>
        )}
      </div>

      {/* TELA DE LOGIN */}
      {modo === 'login' && (
        <div className="login-split" style={{
          minHeight:'calc(100vh - 58px)',
          display:'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: isDesktop ? 'stretch' : 'center',
          justifyContent: isDesktop ? 'flex-start' : 'center',
          position:'relative',
          background:'#f1f5f9',
        }}>

          {/* ── PAINEL ESQUERDO (só desktop) ── */}
          {isDesktop && (
          <div className="login-left" style={{
            display:'flex',
            flexDirection:'column',
            justifyContent:'flex-end',
            width:'58%',
            flexShrink:0,
            position:'relative',
            padding:'0 48px 64px 64px',
            overflow:'hidden',
          }}>
            {/* Foto de fundo */}
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:'url(/batalhao.jpg)',
              backgroundSize:'cover',
              backgroundPosition:'center 30%',
            }} />
            {/* Gradiente overlay — igual ao escaladiaria */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(2,8,16,0.95) 0%, rgba(10,22,40,0.75) 60%, #070f1e 100%)' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(2,8,16,0.90) 0%, transparent 50%)' }} />
            {/* Linha âmbar esquerda */}
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#fbbf24' }} />

            {/* Branding */}
            <div style={{ position:'relative', zIndex:1 }}>
              <img src="/logo.jpeg" alt="32 BPM" style={{ height:84, width:84, objectFit:'contain', marginBottom:20, borderRadius:'50%', border:'2px solid rgba(251,191,36,0.4)', boxShadow:'0 12px 32px rgba(0,0,0,0.5)', display:'block' }} />
              <p style={{ color:'#fbbf24', fontSize:10, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase', margin:'0 0 14px' }}>
                Polícia Militar · Estado do Rio de Janeiro
              </p>
              <h1 style={{ color:'#fff', fontWeight:700, fontSize:64, lineHeight:1, margin:'0 0 10px', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'-1px' }}>
                32º BPM
              </h1>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                <div style={{ width:48, height:1, background:'#fbbf24' }} />
                <span style={{ color:'#475569', fontSize:13, letterSpacing:'0.12em' }}>SEPM · 6° CPA</span>
              </div>
              <p style={{ color:'#cbd5e1', fontSize:22, fontWeight:600, margin:'0 0 8px', fontFamily:"'Rajdhani',sans-serif" }}>
                Controle de Folgas
              </p>
              <p style={{ color:'#475569', fontSize:13, margin:0, lineHeight:1.6, maxWidth:280 }}>
                PCSV · Expediente Semanal — controle e gestão de folgas do efetivo.
              </p>
            </div>
          </div>
          )}

          {/* ── PAINEL DIREITO (form) ── */}
          <div className="login-right" style={{
            flex: isDesktop ? 1 : 'initial',
            width: isDesktop ? 'auto' : '100%',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding: isDesktop ? '48px 32px' : '48px 24px',
            position:'relative',
            background:'#f1f5f9',
          }}>

            {/* Wrapper — max 360px, direto no painel sem card */}
            <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>

              {/* Header do form */}
              <div style={{ marginBottom:32 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <div style={{ width:28, height:1, background:'#1a3a5c' }} />
                  <span style={{ color:'#1a3a5c', fontSize:9, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' }}>Acesso Restrito</span>
                </div>
                <h2 style={{ color:'#0f172a', fontWeight:700, fontSize:48, margin:'0 0 8px', fontFamily:"'Rajdhani',sans-serif", lineHeight:1 }}>Entrar</h2>
                <p style={{ color:'#64748b', fontSize:12, margin:0 }}>Sistema restrito ao efetivo do 32º BPM.</p>
              </div>

              {/* Abas — sem card, só linha */}
              <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', marginBottom:28 }}>
                {[
                  { id:'policial', label:'Sou Policial' },
                  { id:'gestor', label:'Sou Gestor' },
                ].map(a => (
                  <button key={a.id} onClick={() => setAbaLogin(a.id)} style={{
                    flex:1, padding:'10px 8px',
                    fontWeight:700, fontSize:10,
                    cursor:'pointer', border:'none',
                    borderBottom: abaLogin === a.id ? '2px solid #1a3a5c' : '2px solid transparent',
                    background:'transparent',
                    color: abaLogin === a.id ? '#1a3a5c' : '#64748b',
                    transition:'all 0.15s',
                    letterSpacing:'0.12em', textTransform:'uppercase',
                    marginBottom:'-1px',
                  }}>
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo das abas */}
              {abaLogin === 'policial' && (
                <LoginPolicial />
              )}
              {abaLogin === 'gestor' && (
                <div>
                  <p style={{ color:'#475569', fontSize:12, marginBottom:20 }}>
                    Acesso restrito a gestores autorizados.
                  </p>
                  <label style={lbl}>Email</label>
                  <input
                    type="email"
                    value={emailGestor}
                    onChange={e => setEmailGestor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loginGestor()}
                    placeholder="seu.email@exemplo.com"
                    autoComplete="email"
                    style={{ ...inp, marginBottom:10 }}
                  />
                  <label style={lbl}>Senha</label>
                  <input
                    type="password"
                    value={senhaGestor}
                    onChange={e => setSenhaGestor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loginGestor()}
                    placeholder="••••••"
                    autoComplete="current-password"
                    style={{ ...inp, marginBottom:6 }}
                  />
                  {erroLoginGestor && <p style={{ color:'#dc2626', fontSize:12, marginBottom:4 }}>{erroLoginGestor}</p>}
                  <button onClick={loginGestor} disabled={entrandoGestor} style={{ ...btnPrimary, opacity: entrandoGestor ? 0.7 : 1 }}>{entrandoGestor ? 'Entrando...' : 'Entrar'}</button>
                </div>
              )}

              {/* Rodapé */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:32 }}>
                <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                <span style={{ fontSize:9, color:'#94a3b8', fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase' }}>PMERJ · 32º BPM</span>
                <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CARREGANDO (boot — supabase-js restaurando sessão do localStorage) */}
      {modo === 'carregando' && (
        <div style={{ minHeight:'calc(100vh - 58px)', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:13, letterSpacing:'0.12em', textTransform:'uppercase' }}>
          Carregando sessão...
        </div>
      )}

      {/* TROCA DE SENHA OBRIGATÓRIA */}
      {modo === 'trocaSenha' && (usuarioSel || gestorLogado) && (
        <TrocaSenhaObrigatoria perfil={usuarioSel || gestorLogado} onTrocada={aoTrocarSenha} />
      )}

      {/* MÓDULO AJD — toma a tela inteira (tem TopBar próprio) */}
      {modo === 'ajd' && gestorLogado && (
        <AjdApp
          perfil={gestorLogado}
          session={sessionAtual}
          onVoltarPortal={() => setModo('portal')}
        />
      )}

      {/* TELAS INTERNAS (portal / gestor / policial) */}
      {(modo === 'portal' || modo === 'policial' || modo === 'gestor') && (
        <div style={{
          maxWidth: 1100,
          margin: '24px auto',
          padding: '0 16px',
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '32px 28px',
            color: '#0f172a',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            {modo === 'portal' && gestorLogado && <TelaPortal gestor={gestorLogado} onSelecionarInterno={setModo} />}
            {modo === 'policial' && usuarioSel && <TelaSolicitacao usuario={usuarioSel} />}
            {modo === 'gestor' && gestorLogado && <TelaGestor gestorLogado={gestorLogado} />}
          </div>
        </div>
      )}
    </div>
  );
}
