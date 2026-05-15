import React, { useEffect, useRef, useState, useMemo } from 'react';

// ============================================================================
// 1. COMPONENTE: GRÁFICO DE GANTT (Linha do Tempo de Férias/LTS)
// ============================================================================
export function GraficoGanttCanvas({ policiais }) {
const canvasRef = useRef(null);
const [tooltip, setTooltip] = useState(null);

// Filtrar apenas policiais afastados (Férias ou LTS/Apto B/Apto C com data de fim)
const afastados = useMemo(() => {
return policiais.filter(p => {
const taDeFerias = p.situacao === 'Férias' && p.ferias_inicio && p.ferias_fim;
const taLTS = (p.sit_sanitaria === 'LTS' || p.sit_sanitaria === 'Apto B' || p.sit_sanitaria === 'Apto C') && p.ss_inicio && p.ss_fim;
return taDeFerias || taLTS;
}).map(p => {
const tipo = p.situacao === 'Férias' ? 'Férias' : p.sit_sanitaria;
const inicioStr = p.situacao === 'Férias' ? p.ferias_inicio : p.ss_inicio;
const fimStr = p.situacao === 'Férias' ? p.ferias_fim : p.ss_fim;
return {
id: p.id,
nome: ${p.patente} ${p.nome.split(' ').slice(0, 2).join(' ')},
tipo: tipo,
inicio: new Date(inicioStr + 'T00:00:00'),
fim: new Date(fimStr + 'T23:59:59'),
};
}).sort((a, b) => a.inicio - b.inicio);
}, [policiais]);

useEffect(() => {
if (afastados.length === 0) return;

const canvas = canvasRef.current;
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

// Configurações dimensionais
const alturaLinha = 30;
const padding = 20;
const labelWidth = 150;
const canvasWidth = 800; // Largura fixa para exemplo
const canvasHeight = (afastados.length * alturaLinha) + 50 + padding * 2;

canvas.width = canvasWidth * dpr;
canvas.height = canvasHeight * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = `${canvasWidth}px`;
canvas.style.height = `${canvasHeight}px`;

ctx.clearRect(0, 0, canvasWidth, canvasHeight);

// Encontrar data mínima e máxima para o eixo X
const hoje = new Date();
hoje.setHours(0,0,0,0);
let minData = new Date(hoje);
minData.setDate(minData.getDate() - 7); // Começa 7 dias atrás

let maxData = new Date(hoje);
maxData.setDate(maxData.getDate() + 30); // Vai até 30 dias no futuro

afastados.forEach(a => {
  if (a.inicio < minData) minData = new Date(a.inicio);
  if (a.fim > maxData) maxData = new Date(a.fim);
});

const tempoTotal = maxData - minData;
const larguraTimeline = canvasWidth - labelWidth - padding * 2;

// Função para converter Data em posição X no Canvas
const dataParaX = (data) => {
  const proporcao = (data - minData) / tempoTotal;
  return labelWidth + padding + (proporcao * larguraTimeline);
};

// 1. Desenhar Fundo e Linha do Hoje
ctx.fillStyle = '#f8fafc';
ctx.fillRect(labelWidth + padding, padding, larguraTimeline, canvasHeight - padding * 2);

const xHoje = dataParaX(hoje);
if (xHoje >= labelWidth + padding && xHoje <= canvasWidth - padding) {
  ctx.beginPath();
  ctx.moveTo(xHoje, padding);
  ctx.lineTo(xHoje, canvasHeight - padding);
  ctx.strokeStyle = '#B71C1C'; // Linha vermelha para HOJE
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Linha tracejada
  ctx.stroke();
  ctx.setLineDash([]); // Resetar
  
  ctx.fillStyle = '#B71C1C';
  ctx.font = 'bold 10px Inter';
  ctx.fillText('HOJE', xHoje - 12, padding - 5);
}

// 2. Desenhar as Barras
afastados.forEach((afastamento, index) => {
  const y = padding + 30 + (index * alturaLinha);
  
  // Texto (Nome do Policial)
  ctx.fillStyle = '#1a3a5c';
  ctx.font = 'bold 11px Inter';
  ctx.fillText(afastamento.nome, padding, y + 15);

  // Calcular Posição e Tamanho da Barra
  const xInicio = Math.max(dataParaX(afastamento.inicio), labelWidth + padding);
  const xFim = Math.min(dataParaX(afastamento.fim), canvasWidth - padding);
  const larguraBarra = Math.max(xFim - xInicio, 4); // Mínimo de 4px para não sumir

  // Escolher cor baseado no tipo
  let corFundo = '#E3F2FD'; let corBorda = '#0D47A1';
  if (afastamento.tipo === 'Férias') { corFundo = '#E8F5E9'; corBorda = '#1B5E20'; }
  if (afastamento.tipo === 'LTS') { corFundo = '#F3E5F5'; corBorda = '#6A1B9A'; }
  if (afastamento.tipo === 'Apto B') { corFundo = '#FFF8E1'; corBorda = '#F9A825'; }

  // Desenhar Retângulo (Barra do Gantt)
  ctx.fillStyle = corFundo;
  ctx.beginPath();
  ctx.roundRect(xInicio, y, larguraBarra, 20, 4);
  ctx.fill();
  ctx.strokeStyle = corBorda;
  ctx.lineWidth = 1.5;
  ctx.stroke();
});


}, [afastados]);

if (afastados.length === 0) return <p style={{ fontSize:13, color:'#6b8099' }}>Nenhum policial com férias ou LTS registrado no momento.;

return (
<div style={{ overflowX: 'auto', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 12px #00000012' }}>
<h4 style={{ fontSize: 14, fontWeight: 800, color: '#1a3a5c', marginBottom: 12 }}>📊 Linha do Tempo de Afastamentos


);
}

// ============================================================================
// 3. COMPONENTE: QUADRO TÁTICO (Drag and Drop Interativo)
// ============================================================================
export function QuadroTaticoCanvas({ policiais, secoesDisponiveis }) {
const canvasRef = useRef(null);
const [prontos] = useState(() => policiais.filter(p => (p.situacao || 'Pronto') === 'Pronto'));

// Estado interno para gerenciar a posição das "fichas"
const [fichas, setFichas] = useState([]);
const [zonas, setZonas] = useState([]);

// Inicializar zonas e fichas apenas uma vez
useEffect(() => {
// Criar as Zonas (Seções/Viaturas)
const novasZonas = secoesDisponiveis.map((secao, i) => ({
nome: secao,
x: 300 + (i % 3) * 160, // Distribuir em colunas
y: 50 + Math.floor(i / 3) * 120, // Distribuir em linhas
width: 140,
height: 100
}));
setZonas(novasZonas);

// Criar as Fichas (Policiais Prontos) empilhadas no lado esquerdo
const novasFichas = prontos.map((p, i) => ({
  id: p.id,
  texto: p.nome.split(' ').slice(0, 2).join(' '), // Nome curto
  x: 20,
  y: 50 + (i * 35),
  width: 120,
  height: 28,
  cor: '#fff',
  isDragging: false
}));
setFichas(novasFichas);


}, []); // Roda apenas na montagem

// Motor de Desenho do Quadro Tático
useEffect(() => {
if (fichas.length === 0 || zonas.length === 0) return;

const canvas = canvasRef.current;
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

canvas.width = 800 * dpr;
canvas.height = 600 * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = '800px';
canvas.style.height = '600px';

const desenhar = () => {
  ctx.clearRect(0, 0, 800, 600);
  
  // Fundo
  ctx.fillStyle = '#f0f2f5';
  ctx.fillRect(0, 0, 800, 600);

  // Título Esquerdo
  ctx.fillStyle = '#1a3a5c';
  ctx.font = 'bold 12px Inter';
  ctx.fillText('EFETIVO DISPONÍVEL', 20, 30);

  // Desenhar Zonas (Caixas das Seções)
  zonas.forEach(zona => {
    ctx.fillStyle = '#e8f0fe';
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Borda tracejada
    
    ctx.beginPath();
    ctx.roundRect(zona.x, zona.y, zona.width, zona.height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    ctx.fillStyle = '#0D47A1';
    ctx.font = 'bold 12px Inter';
    ctx.fillText(zona.nome, zona.x + 10, zona.y + 20);
  });

  // Desenhar Fichas (Policiais)
  // Desenhamos as que não estão sendo arrastadas primeiro
  const paraDesenhar = [...fichas].sort((a, b) => (a.isDragging ? 1 : -1));

  paraDesenhar.forEach(ficha => {
    // Sombra se estiver arrastando
    if (ficha.isDragging) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
    } else {
      ctx.shadowColor = 'transparent';
    }

    ctx.fillStyle = ficha.isDragging ? '#E3F2FD' : ficha.cor;
    ctx.strokeStyle = '#d0dce8';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(ficha.x, ficha.y, ficha.width, ficha.height, 4);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent'; // Resetar sombra para o texto
    ctx.fillStyle = '#1a3a5c';
    ctx.font = 'bold 11px Inter';
    ctx.fillText(ficha.texto, ficha.x + 8, ficha.y + 18);
  });
};

// Chamar o desenho
requestAnimationFrame(desenhar);


}, [fichas, zonas]); // Redesenha sempre que o estado das fichas mudar

// Lógica de Mouse para Drag and Drop
const handleMouseDown = (e) => {
const canvas = canvasRef.current;
const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

// Verificar se clicou em alguma ficha (de trás pra frente para pegar a de cima)
for (let i = fichas.length - 1; i >= 0; i--) {
  const ficha = fichas[i];
  if (mouseX >= ficha.x && mouseX <= ficha.x + ficha.width &&
      mouseY >= ficha.y && mouseY <= ficha.y + ficha.height) {
    
    // Marca a ficha como 'arrastando' e guarda o offset do clique
    const novasFichas = [...fichas];
    novasFichas[i].isDragging = true;
    novasFichas[i].offsetX = mouseX - ficha.x;
    novasFichas[i].offsetY = mouseY - ficha.y;
    setFichas(novasFichas);
    break; // Arrasta apenas uma
  }
}


};

const handleMouseMove = (e) => {
const arrastando = fichas.find(f => f.isDragging);
if (!arrastando) return;

const canvas = canvasRef.current;
const rect = canvas.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;

// Atualiza X e Y da ficha baseada no mouse
setFichas(prev => prev.map(f => {
  if (f.id === arrastando.id) {
    return { ...f, x: mouseX - f.offsetX, y: mouseY - f.offsetY };
  }
  return f;
}));


};

const handleMouseUp = () => {
// Soltou o mouse. Vamos verificar se caiu dentro de alguma Zona
setFichas(prev => prev.map(ficha => {
if (ficha.isDragging) {
let caiuNaZona = false;

    // Verifica colisão com cada zona
    zonas.forEach(zona => {
      // Checagem simples: O centro da ficha está dentro da zona?
      const centroX = ficha.x + ficha.width / 2;
      const centroY = ficha.y + ficha.height / 2;
      
      if (centroX >= zona.x && centroX <= zona.x + zona.width &&
          centroY >= zona.y && centroY <= zona.y + zona.height) {
        caiuNaZona = true;
      }
    });

    // Se caiu na zona, fica verdinho. Se não, fica branco normal
    return { ...ficha, isDragging: false, cor: caiuNaZona ? '#E8F5E9' : '#fff' };
  }
  return ficha;
}));


};

return (
<div style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 12px #00000012' }}>
<h4 style={{ fontSize: 14, fontWeight: 800, color: '#1a3a5c', marginBottom: 6 }}>🪖 Quadro Tático de Serviço
<p style={{ fontSize: 11, color: '#6b8099', marginBottom: 12 }}>Arraste os policiais disponíveis para montar o policiamento do dia.
<canvas
ref={canvasRef}
onMouseDown={handleMouseDown}
onMouseMove={handleMouseMove}
onMouseUp={handleMouseUp}
onMouseLeave={handleMouseUp} // Se o mouse sair do canvas, solta a ficha
style={{ cursor: 'grab', border: '1px solid #e0e8f0', borderRadius: '8px' }}
/>

);
}
