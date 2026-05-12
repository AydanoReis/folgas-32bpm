/ ============================================
// UTILITÁRIOS - Paginação, Validação, etc
// ============================================

// ========== PAGINAÇÃO ==========
export function paginar(array, pagina = 1, porPagina = 10) {
  const inicio = (pagina - 1) * porPagina;
  const fim = inicio + porPagina;
  const dados = array.slice(inicio, fim);
  const total = array.length;
  const totalPaginas = Math.ceil(total / porPagina);

  return {
    dados,
    pagina,
    porPagina,
    total,
    totalPaginas,
    temProxima: pagina < totalPaginas,
    temAnterior: pagina > 1,
  };
}

// ========== VALIDAÇÕES ==========
export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validarMatricula(matricula) {
  return matricula && matricula.trim().length > 0 && /^\d+$/.test(matricula);
}

export function validarSenha(senha) {
  return senha && senha.length >= 4;
}

// ========== RATE LIMITING ==========
class RateLimiter {
  constructor(maxRequisicoes = 10, janelaMs = 60000) {
    this.maxRequisicoes = maxRequisicoes;
    this.janelaMs = janelaMs;
    this.requisicoes = [];
  }

  podeExecutar() {
    const agora = Date.now();
    // Remove requisições antigas (fora da janela de tempo)
    this.requisicoes = this.requisicoes.filter(t => agora - t < this.janelaMs);

    if (this.requisicoes.length < this.maxRequisicoes) {
      this.requisicoes.push(agora);
      return { permitido: true, proxemaEmMs: null };
    }

    const tempoAteReset = this.janelaMs - (agora - this.requisicoes[0]);
    return { permitido: false, proxemaEmMs: Math.ceil(tempoAteReset / 1000) };
  }
}

export const rateLimiterSolicitacao = new RateLimiter(5, 60000); // 5 requisições por minuto
export const rateLimiterAprovacao = new RateLimiter(20, 60000); // 20 aprovações por minuto

// ========== HISTÓRICO DE ALTERAÇÕES ==========
export async function registrarHistorico(supabase, tabela, acao, dados, usuarioId, usuarioNome) {
  try {
    await supabase.from('historico_alteracoes').insert({
      tabela,
      acao,
      dados: JSON.stringify(dados),
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      ip: await obterIP(),
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Erro ao registrar histórico:', e);
  }
}

export async function obterIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'desconhecido';
  }
}

// ========== EXPORTAÇÃO PARA EXCEL ==========
export function exportarParaCSV(dados, nome = 'export') {
  if (!dados || dados.length === 0) {
    alert('Nenhum dado para exportar');
    return;
  }

  // Headers
  const headers = Object.keys(dados[0]);
  const csvContent = [
    headers.join(','),
    ...dados.map(row => headers.map(h => {
      const valor = row[h];
      // Escapar aspas e valores com vírgula
      if (typeof valor === 'string' && (valor.includes(',') || valor.includes('"'))) {
        return `"${valor.replace(/"/g, '""')}"`;
      }
      return valor || '';
    }).join(',')),
  ].join('\n');

  // BOM para UTF-8 (garante acentuação)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${nome}_${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
}

export function exportarParaExcel(dados, nome = 'export', nomeAba = 'Dados') {
  if (!dados || dados.length === 0) {
    alert('Nenhum dado para exportar');
    return;
  }

  const headers = Object.keys(dados[0]);
  
  // Criar HTML da tabela (Excel consegue ler)
  let html = `<table border="1"><thead><tr>`;
  headers.forEach(h => html += `<th>${h}</th>`);
  html += `</tr></thead><tbody>`;
  
  dados.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      html += `<td>${row[h] || ''}</td>`;
    });
    html += '</tr>';
  });
  
  html += `</tbody></table>`;

  const blob = new Blob(['\uFEFF<html><meta charset="UTF-8">' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${nome}_${new Date().toISOString().split('T')[0]}.xls`);
  link.click();
}

// ========== FORMATAÇÕES ==========
export function formatarData(dataStr) {
  if (!dataStr) return '—';
  try {
    return new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
}

export function formatarDataHora(dataStr) {
  if (!dataStr) return '—';
  try {
    return new Date(dataStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataStr;
  }
}

// ========== CORES E ESTILOS ==========
export const CORES_STATUS = {
  pendente: { bg: '#FFF8E1', text: '#7B5800', border: '#FFD54F' },
  aprovado: { bg: '#E8F5E9', text: '#1B5E20', border: '#A5D6A7' },
  recusado: { bg: '#FFEBEE', text: '#B71C1C', border: '#EF9A9A' },
};

export const COR_SS = {
  'Apto A': '#1565C0',
  'Apto B': '#F9A825',
  'Apto C': '#B71C1C',
  'LTS': '#6A1B9A',
};

export const EMOJI_SS = {
  'Apto A': '🔵',
  'Apto B': '🟡',
  'Apto C': '🔴',
  'LTS': '🟣',
};

// ========== COMPONENTES REUTILIZÁVEIS ==========
export function ComponentePaginacao({ paginaAtual, totalPaginas, onMudarPagina }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#f0f4f8',
      borderRadius: 10,
      padding: '10px 14px',
      marginTop: 14,
      fontSize: 12,
      color: '#6b8099',
    }}>
      <button
        onClick={() => onMudarPagina(paginaAtual - 1)}
        disabled={paginaAtual === 1}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: 'none',
          background: '#fff',
          color: '#1a3a5c',
          cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          opacity: paginaAtual === 1 ? 0.5 : 1,
        }}
      >
        ← Anterior
      </button>
      <span style={{ fontWeight: 700, color: '#1a3a5c' }}>
        Página {paginaAtual} de {totalPaginas}
      </span>
      <button
        onClick={() => onMudarPagina(paginaAtual + 1)}
        disabled={paginaAtual === totalPaginas}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: 'none',
          background: '#fff',
          color: '#1a3a5c',
          cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          opacity: paginaAtual === totalPaginas ? 0.5 : 1,
        }}
      >
        Próxima →
      </button>
    </div>
  );
}

// ========== DETALHES DO POLICIAL ==========
export function DetalhesPolicialCard({ policial }) {
  return (
    <div style={{
      background: '#f0f6ff',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 12,
      border: '1px solid #d0dce8',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 800, color: '#1a3a5c', flex: 1 }}>
          {policial.patente} {policial.nome}
        </div>
        <span style={{ color: '#6b8099', fontSize: 12 }}>Mat. {policial.matricula}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
        <div style={{ background: '#fff', borderRadius: 6, padding: '8px', fontSize: 11 }}>
          <span style={{ color: '#6b8099', fontWeight: 700 }}>📍 Seção</span>
          <div style={{ color: '#1a3a5c', fontWeight: 800, marginTop: 2 }}>
            {policial.secao || '—'}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 6, padding: '8px', fontSize: 11 }}>
          <span style={{ color: '#6b8099', fontWeight: 700 }}>🏥 Sit. Sanitária</span>
          <div style={{ color: COR_SS[policial.sit_sanitaria || 'Apto A'], fontWeight: 800, marginTop: 2 }}>
            {EMOJI_SS[policial.sit_sanitaria || 'Apto A']} {policial.sit_sanitaria || 'Apto A'}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 6, padding: '8px', fontSize: 11 }}>
          <span style={{ color: '#6b8099', fontWeight: 700 }}>📋 Situação</span>
          <div style={{
            color: (policial.situacao || 'Pronto') === 'Pronto' ? '#1B5E20' : '#B71C1C',
            fontWeight: 800,
            marginTop: 2,
          }}>
            {policial.situacao || 'Pronto'}
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 6, padding: '8px', fontSize: 11 }}>
          <span style={{ color: '#6b8099', fontWeight: 700 }}>⚠️ Restrição</span>
          <div style={{
            color: (policial.restricao || 'Sem restrição') === 'Sem restrição' ? '#1B5E20' : '#E65100',
            fontWeight: 800,
            marginTop: 2,
          }}>
            {policial.restricao || 'Sem restrição'}
          </div>
        </div>
      </div>
    </div>
  );
}
