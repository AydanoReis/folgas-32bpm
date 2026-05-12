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
  formatarDataHora,
  CORES_STATUS,
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
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, margin:'12px 0' }}>
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

// ========== GERADOR DE PDF ==========
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
    doc.setFillColor(50,100,150); doc.rect(10,y,pageW-20,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('SITUAÇÃO DO EFETIVO', 14, y+5.5); y += 10;
    doc.autoTable({ startY:y, head:[['Situação','Total']], body:SITUACOES.map(s=>[s,String(policiais.filter(p=>(p.situacao||'Pronto')===s).length)]), theme:'grid', headStyles:{ fillColor:[50,100,150], textColor:255, fontStyle:'bold', fontSize:8 }, bodyStyles:{ fontSize:8 }, alternateRowStyles:{ fillColor:[245,248,252] }, margin:{ left:10, right:10 } });
    y = doc.lastAutoTable.finalY + 6;
    if (semFolga.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFillColor(13,35,64); doc.rect(10,y,pageW-20,8,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(`PRONTOS SEM SOLICITAÇÃO ESTA SEMANA (${semFolga.length})`, 14, y+5.5); y += 10;
      doc.autoTable({ startY:y, head:[['Patente','Nome','Matrícula','Seção']], body:semFolga.map(p=>[p.patente,p.nome,p.matricula,p.secao||'—']), theme:'grid', headStyles:{ fillColor:[13,35,64], textColor:255, fontStyle:'bold', fontSize:8 }, bodyStyles:{ fontSize:8 }, alternateRowStyles:{ fillColor:[245,248,252] }, margin:{ left:10, right:10 } });
      y = doc.lastAutoTable.finalY + 6;
    }
  }
  if (aprovadas.length > 0) {
    if (y > 180) { doc.addPage(); y = 20; }
    doc.setFillColor(50,100,150); doc.rect(10,y,pageW-20,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('MATRIZ DE DISTRIBUIÇÃO POR SEÇÃO E DIA', 14, y+5.5); y += 10;
    const secoesComFolga = [...new Set(aprovadas.map(s => s.secao))].sort();
    const bodyMatriz = secoesComFolga.map(secao => [secao, ...DIAS.map(dia => { const c = aprovadas.filter(s=>s.secao===secao&&s.dia===dia).length; return c>0?String(c):'—'; }), String(aprovadas.filter(s=>s.secao===secao).length)]);
    bodyMatriz.push(['TOTAL', ...DIAS.map(dia => { const c = aprovadas.filter(s=>s.dia===dia).length; return c>0?String(c):'—'; }), String(aprovadas.length)]);
    doc.autoTable({ startY:y, head:[['Seção',...DIAS.map(d=>d.substring(0,3)),'Total']], body:bodyMatriz, theme:'grid', headStyles:{ fillColor:[13,35,64], textColor:255, fontStyle:'bold', fontSize:7 }, bodyStyles:{ fontSize:7 }, alternateRowStyles:{ fillColor:[245,248,252] }, didParseCell:(data)=>{ if(data.row.index===bodyMatriz.length-1){ data.cell.styles.fontStyle='bold'; data.cell.styles.fillColor=[220,228,236]; } }, margin:{ left:10, right:10 } });
  }
  doc.setTextColor(120,130,140); doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('32º BPM — Sistema Interno de Controle de Folgas', pageW/2, pageH-8, { align:'center' });
  doc.text('Página 3', pageW-12, pageH-8, { align:'right' });
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
  const ltsProximos = policiais.filter(p => (p.sit_sanitaria||'Apto A') === 'LTS' && p.ferias_fim && diasParaRetorno(p.ferias_fim) !== null && diasParaRetorno(p.ferias_fim) <= 3 && diasParaRetorno(p.ferias_fim) >= 0);
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
          {ltsProximos.map(p => { const dias = diasParaRetorno(p.ferias_fim); return (<div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}><span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span><span style={{ background:dias===0?'#6A1B9A':'#AB47BC', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Retorna hoje!':dias===1?'Retorna amanhã!':`${dias} dias`}</span></div>); })}
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
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

      {policiais.filter(p => (p.situacao||'Pronto') !== 'Pronto').length > 0 && (
        <Card>
          <h4 style={{ fontSize:13, fontWeight:800, color:'#1a3a5c', marginBottom:12 }}>🚨 Policiais Afastados</h4>
          {SITUACOES.filter(sit => sit !== 'Pronto').map(sit => {
            const afastados = policiais.filter(p => (p.situacao||'Pronto') === sit);
            if (afastados.length === 0) return null;
            return (
              <div key={sit} style={{ marginBottom:12 }}>
                <div style={{ fontWeight:800, color:'#B71C1C', fontSize:12, marginBottom:6, background:'#FFEBEE', borderRadius:6, padding:'4px 10px', display:'inline-block' }}>{sit} ({afastados.length})</div>
                {afastados.map(p => { const dias = diasParaRetorno(p.ferias_fim); return (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f0f4f8', flexWrap:'wrap', gap:6 }}>
                    <span style={{ fontWeight:700, color:'#1a3a5c', fontSize:12 }}>{p.patente} {p.nome}</span>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {p.ferias_fim && <span style={{ color:'#6b8099', fontSize:11 }}>{p.ferias_inicio?new Date(p.ferias_inicio+'T00:00:00').toLocaleDateString('pt-BR'):'—'} → {new Date(p.ferias_fim+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      {dias!==null&&dias>=0&&<span style={{ background:dias<=3?'#B71C1C':'#1B5E20', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{dias===0?'Retorna hoje!':dias===1?'1 dia':`${dias} dias`}</span>}
                      {dias!==null&&dias<0&&<span style={{ background:'#7B5800', color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:800 }}>Vencido</span>}
                    </div>
                  </div>
                ); })}
              </div>
            );
          })}
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
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

// ========== LOGIN DO POLICIAL (v2.0 com busca por nome) ==========
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
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  useEffect(() => {
    supabase.from('policiais').select('*').order('nome')
      .then(({ data }) => { setPoliciais(data || []); setCarregando(false); });
  }, []);

  const policiaisFiltrados = buscaLogin.length >= 2
    ? policiais.filter(p => p.nome.toLowerCase().includes(buscaLogin.toLowerCase()) || p.matricula.includes(buscaLogin)).slice(0, 8)
    : [];

  function selecionarPolicial(p) { setPolicialSel(p); setBuscaLogin(p.nome); setMostrarSugestoes(false); setErro(''); }

  async function entrar() {
    if (!policialSel) { setErro('Selecione seu nome na lista.'); return; }
    if (!senha) { setErro('Digite sua senha.'); return; }
    if (!policialSel.senha) { setModo('cadastrar'); return; }
    if (policialSel.senha !== senha) { setErro('Senha incorreta.'); return; }
    salvarSessao('policial', policialSel);
    onLogin(policialSel);
  }

  async function cadastrarSenha() {
    if (!validarSenha(novaSenha)) { setErro('Senha deve ter no mínimo 4 caracteres.'); return; }
    if (novaSenha !== confirmarSenha) { setErro('As senhas não coincidem.'); return; }
    const { data, error } = await supabase.from('policiais').update({ senha:novaSenha }).eq('id', policialSel.id).select().single();
    if (error || !data) { setErro('Erro ao criar senha.'); return; }
    salvarSessao('policial', data);
    onLogin(data);
  }

  if (modo === 'cadastrar') return (
    <div>
      <h2 style={{ color:'#1a3a5c', fontWeight:700, fontSize:16, marginBottom:4, marginTop:0 }}>Primeiro acesso</h2>
      <p style={{ color:'#6b8099', fontSize:13, fontWeight:400, marginBottom:16 }}>Olá, <strong>{policialSel.nome}</strong>! Cadastre sua senha.</p>
      <label style={lbl}>Nova senha *</label>
      <input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:10 }} />
      <label style={lbl}>Confirmar senha *</label>
      <input type="password" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} placeholder="Repita a senha" style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:6 }}>{erro}</p>}
      <button onClick={cadastrarSenha} style={{ ...btnPrimary, letterSpacing:0.5, textTransform:'uppercase', fontSize:13 }}>Cadastrar e Entrar</button>
      <button onClick={() => setModo('login')} style={{ ...btnPrimary, background:'#f0f4f8', color:'#6b8099', marginTop:6 }}>Voltar</button>
    </div>
  );

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
      <button onClick={entrar} style={{ ...btnPrimary, letterSpacing:0.5, textTransform:'uppercase', fontSize:13 }}>Entrar</button>
      <p style={{ color:'#aab', fontSize:11, marginTop:10, textAlign:'center', fontWeight:400 }}>Esqueceu a senha? Fale com o gestor para resetar.</p>
    </div>
  );
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
    if (!check.permitido) { setMsg({ tipo:'erro', texto:`Aguarde ${check.proxemaEmMs}s antes de enviar nova solicitação.` }); return; }
    const jaExiste = minhas.find(s => s.semana === semana && s.motivo === motivo && s.status !== 'recusado');
    if (jaExiste) { setMsg({ tipo:'erro', texto:`Você já possui uma ${motivo} solicitada para esta semana.` }); return; }
    setEnviando(true);
    const { error } = await supabase.from('solicitacoes').insert({ policial_id:usuario.id, policial_nome:usuario.nome, matricula:usuario.matricula, patente:usuario.patente, secao:usuario.secao||'—', dia, semana, motivo, status:'pendente', email_policial:email });
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
  const [toast, setToast] = useState(null);
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

  function showToast(texto, tipo = 'ok') {
    setToast({ texto, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  async function mudarStatus(id, status) {
    if (!isMaster) return;
    const check = rateLimiterAprovacao.podeExecutar();
    if (!check.permitido) { showToast(`Aguarde ${check.proxemaEmMs}s antes de fazer nova aprovação`, 'erro'); return; }
    await supabase.from('solicitacoes').update({ status }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    showToast(status === 'aprovado' ? '✅ Solicitação aprovada!' : '❌ Solicitação recusada!', status === 'aprovado' ? 'ok' : 'erro');
    const sol = solicitacoes.find(s => s.id === id);
    if (sol && sol.email_policial && status !== 'pendente') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { email:sol.email_policial, nome:sol.policial_nome, motivo:sol.motivo, dia:sol.dia, semana:sol.semana, status:status==='aprovado'?'✅ APROVADA':'❌ RECUSADA', secao:sol.secao, matricula:sol.matricula });
    }
    registrarHistorico(supabase, 'solicitacoes', 'mudança_status', { id, status }, gestorLogado.id, gestorLogado.nome);
  }

  async function aprovarTroca(sol) {
    if (!isMaster) return;
    await supabase.from('solicitacoes').update({ dia:sol.dia_troca, status_troca:'aprovado' }).eq('id', sol.id);
    setSolicitacoes(prev => prev.map(s => s.id === sol.id ? { ...s, dia:sol.dia_troca, status_troca:'aprovado' } : s));
    showToast('✅ Troca aprovada!');
  }

  async function recusarTroca(id) {
    if (!isMaster) return;
    await supabase.from('solicitacoes').update({ status_troca:'recusado' }).eq('id', id);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status_troca:'recusado' } : s));
    showToast('❌ Troca recusada.', 'erro');
  }

  async function excluirSolicitacao(id) {
    if (!window.confirm('Excluir esta solicitação?')) return;
    await supabase.from('solicitacoes').delete().eq('id', id);
    setSolicitacoes(prev => prev.filter(s => s.id !== id));
  }

  async function resetarSenhaPolicial(id, nome) {
    if (!window.confirm(`Resetar a senha de ${nome}?`)) return;
    await supabase.from('policiais').update({ senha:'' }).eq('id', id);
    showToast('🔑 Senha resetada!');
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
    if (!novoNome.trim() || !validarMatricula(novaMatricula) || !novaSecao) { alert('Preencha todos os campos corretamente'); return; }
    const { data, error } = await supabase.from('policiais').insert({ nome:novoNome.toUpperCase(), matricula:novaMatricula, patente:novaPatente, secao:novaSecao, senha:'', sit_sanitaria:'Apto A', situacao:'Pronto', restricao:'Sem restrição' }).select().single();
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
    if (!novoGestorNome.trim() || !validarMatricula(novoGestorMatricula) || !validarSenha(novoGestorSenha)) { setMsgGestor({ tipo:'erro', texto:'Preencha todos os campos corretamente.' }); return; }
    if (gestores.find(g => g.matricula === novoGestorMatricula)) { setMsgGestor({ tipo:'erro', texto:'Matrícula já cadastrada.' }); return; }
    const { data, error } = await supabase.from('gestores').insert({ nome:novoGestorNome.toUpperCase(), matricula:novoGestorMatricula, senha:novoGestorSenha, principal:false, nivel:novoGestorNivel, funcao:novoGestorFuncao }).select().single();
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
    { id:'estatisticas', label:'📈 Estatísticas' },
    { id:'efetivo', label:'👮 Efetivo' },
    { id:'gestores', label:'🗝️ Gestores' },
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
                      {/* Contador compacto do policial */}
                      {policial && <ContadorFolgas solicitacoes={solicitacoes} policialId={s.policial_id} compact={true} />}
                      {/* Detalhes do policial */}
                      {policial && (
                        <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
                          <div><span style={{ color:'#6b8099', fontWeight:700 }}>🏥 Sit. Sanitária:</span><div style={{ color:COR_SS[policial.sit_sanitaria||'Apto A'], fontWeight:800, marginTop:2 }}>{EMOJI_SS[policial.sit_sanitaria||'Apto A']} {policial.sit_sanitaria||'Apto A'}</div></div>
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
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a3a5c', marginBottom:14 }}>📅 Calendário de Folgas Aprovadas</h3>
          <CalendarioFolgas solicitacoes={solicitacoes} />
        </Card>
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
                  <ContadorFolgas solicitacoes={solicitacoes} policialId={p.id} compact={true} />
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

  const [abaLogin, setAbaLogin] = useState('policial');

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* CABEÇALHO */}
      <div style={{ background:'linear-gradient(135deg,#0d2340 0%,#1a3a5c 60%,#1e4d7b 100%)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 20px #00000040' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:42, width:42, objectFit:'contain' }} />
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:17, letterSpacing:0.3 }}>32º BPM — Controle de Folgas</div>
            <div style={{ color:'#8db4d8', fontSize:11, fontWeight:400 }}>PCSV · Expediente Semanal · v2.1</div>
          </div>
        </div>
        {modo !== 'login' && <button onClick={sair} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>← Sair</button>}
      </div>

      {/* TELA DE LOGIN */}
      {modo === 'login' && (
        <div style={{
          minHeight:'calc(100vh - 74px)',
          position:'relative',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          padding:'24px 16px',
        }}>
          {/* FOTO DE FUNDO */}
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:'url(/batalhao.jpg)',
            backgroundSize:'cover',
            backgroundPosition:'center 30%',
            filter:'brightness(0.35) saturate(0.8)',
          }} />
          {/* OVERLAY AZUL */}
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(160deg, rgba(13,35,64,0.72) 0%, rgba(30,77,123,0.55) 100%)',
          }} />

          {/* CARD DE LOGIN */}
          <div style={{
            position:'relative', zIndex:1,
            width:'100%', maxWidth:420,
            background:'#fff',
            borderRadius:16,
            boxShadow:'0 20px 60px rgba(0,0,0,0.35)',
            overflow:'hidden',
          }}>
            {/* TOPO DO CARD */}
            <div style={{ background:'linear-gradient(135deg,#0d2340,#1e4d7b)', padding:'28px 32px 24px', textAlign:'center' }}>
              <img src="/logo.jpeg" alt="32 BPM" style={{ height:56, width:56, objectFit:'contain', marginBottom:12 }} />
              <h1 style={{ color:'#fff', fontWeight:700, fontSize:18, margin:0, letterSpacing:0.2 }}>Acesso ao Sistema</h1>
              <p style={{ color:'#8db4d8', fontSize:12, fontWeight:400, margin:'6px 0 0' }}>
                Sistema restrito ao uso do efetivo do 32º BPM
              </p>
            </div>

            {/* ABAS */}
            <div style={{ display:'flex', borderBottom:'2px solid #f0f2f5' }}>
              {[
                { id:'policial', label:'👮 Sou Policial' },
                { id:'gestor', label:'🗂️ Sou Gestor' },
              ].map(a => (
                <button key={a.id} onClick={() => setAbaLogin(a.id)} style={{
                  flex:1, padding:'14px 8px',
                  fontWeight: abaLogin === a.id ? 700 : 500,
                  fontSize:13,
                  cursor:'pointer',
                  border:'none',
                  borderBottom: abaLogin === a.id ? '3px solid #1a3a5c' : '3px solid transparent',
                  background:'#fff',
                  color: abaLogin === a.id ? '#1a3a5c' : '#6b8099',
                  transition:'all 0.15s',
                  marginBottom:'-2px',
                }}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div style={{ padding:'24px 32px 28px' }}>
              {abaLogin === 'policial' && (
                <LoginPolicial onLogin={p => { setUsuarioSel(p); setModo('policial'); }} />
              )}
              {abaLogin === 'gestor' && (
                <div>
                  <p style={{ color:'#6b8099', fontSize:13, fontWeight:400, marginBottom:20, marginTop:0 }}>
                    Acesso restrito a gestores autorizados.
                  </p>
                  <label style={lbl}>Senha de acesso</label>
                  <input
                    type="password"
                    value={senhaGestor}
                    onChange={e => setSenhaGestor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loginGestor()}
                    placeholder="••••••"
                    style={{ ...inp, marginBottom:6 }}
                  />
                  {erroSenha && <p style={{ color:'#B71C1C', fontSize:12, marginBottom:4 }}>Senha incorreta. Tente novamente.</p>}
                  <button onClick={loginGestor} style={{ ...btnPrimary, marginTop:12, letterSpacing:0.5, textTransform:'uppercase', fontSize:13 }}>
                    Entrar
                  </button>
                </div>
              )}
            </div>

            {/* RODAPÉ DO CARD */}
            <div style={{ borderTop:'1px solid #f0f2f5', padding:'12px 32px', textAlign:'center' }}>
              <span style={{ fontSize:11, color:'#aab', fontWeight:400 }}>
                Polícia Militar do Estado do Rio de Janeiro · 32º BPM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TELAS INTERNAS */}
      {modo !== 'login' && (
        <div style={{ maxWidth:740, margin:'28px auto', padding:'0 14px' }}>
          {modo === 'policial' && usuarioSel && <TelaSolicitacao usuario={usuarioSel} />}
          {modo === 'gestor' && gestorLogado && <TelaGestor gestorLogado={gestorLogado} />}
        </div>
      )}
    </div>
  );
}
