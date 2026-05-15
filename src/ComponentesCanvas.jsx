import React, { useRef, useEffect, useState } from 'react';

// ==========================================
// 1. GRÁFICO DE GANTT (LINHA DO TEMPO)
// ==========================================
export function GraficoGanttCanvas({ policiais }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Filtrar apenas policiais com férias ou LTS ativas/futuras
    const afastados = policiais.filter(p => 
      (p.situacao === 'Férias' && p.ferias_inicio && p.ferias_fim) || 
      (p.sit_sanitaria !== 'Apto A' && p.ss_inicio && p.ss_fim)
    );

    // Ajustar tamanho do canvas baseado na quantidade de dados
    const alturaNecessaria = Math.max(200, 60 + (afastados.length * 30));
    canvas.height = alturaNecessaria;
    canvas.width = canvas.parentElement.clientWidth || 700;
    const { width, height } = canvas;

    // Limpar fundo
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    if (afastados.length === 0) {
      ctx.fillStyle = '#6b8099';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhum afastamento prolongado programado.', width / 2, height / 2);
      return;
    }

    // Configurações do Grid e Linha do Tempo
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const diasParaFrente = 30; // Mostrar 30 dias na linha do tempo
    const larguraDia = (width - 150) / diasParaFrente; // 150px reservados para os nomes
    
    // Desenhar cabeçalho dos dias
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, 0, width, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= diasParaFrente; i++) {
      const dataCol = new Date(hoje);
      dataCol.setDate(dataCol.getDate() + i);
      const x = 150 + (i * larguraDia);
      
      // Linhas verticais do grid
      ctx.beginPath();
      ctx.strokeStyle = '#e2e8f0';
      ctx.moveTo(x, 30);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Texto do dia (mostrar a cada 2 dias para não amontoar)
      if (i % 2 === 0) {
        ctx.fillText(`${dataCol.getDate()}/${dataCol.getMonth() + 1}`, x + (larguraDia/2), 20);
      }
    }

    // Desenhar as barras de cada policial
    ctx.textAlign = 'left';
    afastados.forEach((p, index) => {
      const y = 40 + (index * 30);
      
      // Desenhar Nome
      ctx.fillStyle = '#1a3a5c';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`${p.patente} ${p.nome.split(' ')[0]}`, 10, y + 15);

      // Calcular posição da barra
      const isFerias = p.situacao === 'Férias';
      const inicioStr = isFerias ? p.ferias_inicio : p.ss_inicio;
      const fimStr = isFerias ? p.ferias_fim : p.ss_fim;
      
      const dtInicio = new Date(inicioStr + 'T00:00:00');
      const dtFim = new Date(fimStr + 'T00:00:00');
      
      // Diferença em dias em relação a hoje
      const diffInicio = Math.ceil((dtInicio - hoje) / (1000 * 60 * 60 * 24));
      const diffFim = Math.ceil((dtFim - hoje) / (1000 * 60 * 60 * 24));

      // Limitar a barra para caber na tela (0 a 30 dias)
      const startX = 150 + (Math.max(0, diffInicio) * larguraDia);
      const endX = 150 + (Math.min(diasParaFrente, Math.max(0, diffFim + 1)) * larguraDia);
      const barWidth = Math.max(0, endX - startX);

      if (barWidth > 0 && diffFim >= 0 && diffInicio <= diasParaFrente) {
        // Cor baseada no tipo de afastamento
        ctx.fillStyle = isFerias ? '#F9A825' : (p.sit_sanitaria === 'Apto B' ? '#F57F17' : '#B71C1C');
        
        // Desenhar barra arredondada (simulada)
        ctx.beginPath();
        ctx.roundRect(startX + 2, y + 2, barWidth - 4, 20, 6);
        ctx.fill();

        // Texto dentro da barra
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        const label = isFerias ? 'Férias' : p.sit_sanitaria;
        if (barWidth > 40) {
          ctx.fillText(label, startX + 6, y + 15);
        }
      }
    });

  }, [policiais]);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px #00000012' }}>
      <h4 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:12 }}>📅 Linha do Tempo (Próximos 30 dias)</h4>
      <div style={{ overflowX: 'auto' }}>
        <canvas ref={canvasRef} style={{ display: 'block', minWidth: 600, border: '1px solid #e2e8f0', borderRadius: 8 }} />
      </div>
    </div>
  );
}


// ==========================================
// 2. QUADRO TÁTICO (DRAG AND DROP)
// ==========================================
export function QuadroTaticoCanvas({ policiais, secoesDisponiveis }) {
  const canvasRef = useRef(null);
  const [fichas, setFichas] = useState([]);
  const [arrastando, setArrastando] = useState(null);

  // Inicializar fichas apenas na primeira vez ou quando a lista mudar drasticamente
  useEffect(() => {
    const prontos = policiais.filter(p => p.situacao === 'Pronto' || !p.situacao);
    
    const novasFichas = prontos.map((p, i) => ({
      id: p.id,
      texto: `${p.patente} ${p.nome.split(' ')[0]}`,
      // Posicionar inicialmente do lado esquerdo (banco de reservas)
      x: 20 + (i % 2) * 110, 
      y: 50 + Math.floor(i / 2) * 40,
      w: 100,
      h: 30,
      secaoOriginal: p.secao
    }));
    
    setFichas(novasFichas);
  }, [policiais]);

  // Função principal de desenho
  const desenhar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Fundo
    ctx.fillStyle = '#0d2340'; // Cor do quadro tático
    ctx.fillRect(0, 0, width, height);

    // Linha divisória
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 0);
    ctx.lineTo(250, height);
    ctx.stroke();

    // Títulos das áreas
    ctx.fillStyle = '#8db4d8';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('EFETIVO DISPONÍVEL', 20, 25);
    ctx.fillText('ALOCAÇÃO TÁTICA (SEÇÕES / POSTOS)', 270, 25);

    // Desenhar caixas das Seções (Zonas de soltar)
    const zonas = secoesDisponiveis.slice(0, 6); // Mostrar até 6 zonas para caber
    zonas.forEach((secao, i) => {
      const zx = 270 + (i % 2) * 200;
      const zy = 50 + Math.floor(i / 2) * 120;
      
      // Fundo da seção
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.roundRect(zx, zy, 180, 100, 8);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Título da seção
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`📍 ${secao}`, zx + 10, zy + 20);
    });

    // Desenhar Fichas dos Policiais
    fichas.forEach(ficha => {
      // Sombra da ficha
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      
      // Fundo da ficha (se estiver sendo arrastada, fica amarela)
      ctx.fillStyle = arrastando === ficha.id ? '#FFD54F' : '#ffffff';
      ctx.beginPath();
      ctx.roundRect(ficha.x, ficha.y, ficha.w, ficha.h, 6);
      ctx.fill();
      
      // Resetar sombra para o texto
      ctx.shadowColor = 'transparent';
      
      // Texto da ficha
      ctx.fillStyle = '#1a3a5c';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(ficha.texto, ficha.x + 10, ficha.y + 19);
      
      // Indicador de seção original
      if (ficha.secaoOriginal) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(ficha.x + ficha.w - 12, ficha.y + 4, 8, 8, 4);
        ctx.fill();
      }
    });
  };

  // Redesenhar sempre que fichas ou arrastando mudarem
  useEffect(() => {
    desenhar();
  }, [fichas, arrastando]);

  // Eventos de Mouse para Drag and Drop
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Verificar se clicou em alguma ficha (de trás pra frente para pegar a que está por cima)
    for (let i = fichas.length - 1; i >= 0; i--) {
      const f = fichas[i];
      if (mx >= f.x && mx <= f.x + f.w && my >= f.y && my <= f.y + f.h) {
        setArrastando(f.id);
        break;
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!arrastando) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setFichas(prev => prev.map(f => 
      f.id === arrastando ? { ...f, x: mx - f.w/2, y: my - f.h/2 } : f
    ));
  };

  const handleMouseUp = () => {
    setArrastando(null);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px #00000012' }}>
      <h4 style={{ fontSize:14, fontWeight:800, color:'#1a3a5c', marginBottom:6 }}>🗺️ Quadro Tático Interativo</h4>
      <p style={{ fontSize:11, color:'#6b8099', marginBottom:12 }}>Clique e arraste os policiais do efetivo disponível para alocá-los nas seções (apenas visualização tática).</p>
      
      <canvas 
        ref={canvasRef} 
        width={700} 
        height={400} 
        style={{ width: '100%', borderRadius: 8, cursor: arrastando ? 'grabbing' : 'grab' }} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

export default function PreviewCanvas() {
  const mockPoliciais = [
    { id: 1, nome: "SILVA", patente: "CB PM", situacao: "Férias", ferias_inicio: "2026-05-10", ferias_fim: "2026-05-25", secao: "P1" },
    { id: 2, nome: "SANTOS", patente: "3º SGT PM", sit_sanitaria: "Apto B", ss_inicio: "2026-05-12", ss_fim: "2026-05-18", secao: "P3" },
    { id: 3, nome: "OLIVEIRA", patente: "SD PM", situacao: "Pronto", secao: "P4" },
    { id: 4, nome: "COSTA", patente: "CB PM", situacao: "Pronto", secao: "Rancho" }
  ];
  const mockSecoes = ['P1', 'P3', 'P4', 'P5', 'Rancho', 'Secretaria'];

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, sans-serif', background: '#f0f2f5', minHeight: '100vh' }}>
      <h2 style={{ color: '#1a3a5c', marginBottom: 20 }}>Pré-visualização dos Componentes</h2>
      <GraficoGanttCanvas policiais={mockPoliciais} />
      <div style={{ marginTop: 30 }}>
        <QuadroTaticoCanvas policiais={mockPoliciais} secoesDisponiveis={mockSecoes} />
      </div>
    </div>
  );
}
