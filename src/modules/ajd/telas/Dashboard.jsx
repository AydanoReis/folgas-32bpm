// ============================================================
// Dashboard — visão geral dos procedimentos
// ============================================================
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  statusCalculado, diasRestantes, calcDataLimite, formatarData,
} from '../utils';
import { btnGhost } from '../styles';
import SectionTitle from '../components/SectionTitle';
import CardKPI from '../components/CardKPI';

export default function Dashboard({ procedimentos, tipos, onIrPara }) {
  const total = procedimentos.length;
  const porStatus = procedimentos.reduce((acc, p) => {
    const s = statusCalculado(p);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const dentro     = porStatus.dentro_prazo       || 0;
  const proximo    = porStatus.proximo_vencimento || 0;
  const vencido    = porStatus.vencido            || 0;
  const sobrestado = porStatus.sobrestado         || 0;
  const concluido  = porStatus.concluido          || 0;
  const ativos     = total - concluido;

  const porTipo = tipos
    .map((t) => ({
      nome: t.nome,
      quantidade: procedimentos.filter(
        (p) => p.tipo_id === t.id && p.status !== 'concluido'
      ).length,
    }))
    .filter((t) => t.quantidade > 0);

  const pieData = [
    { name: 'Dentro do prazo',  value: dentro,     fill: '#22c55e' },
    { name: 'Próximo do venc.', value: proximo,    fill: '#f59e0b' },
    { name: 'Vencidos',         value: vencido,    fill: '#ef4444' },
    { name: 'Sobrestados',      value: sobrestado, fill: '#a855f7' },
  ].filter((d) => d.value > 0);

  const proximosFim = procedimentos
    .filter((p) => p.status === 'andamento')
    .map((p) => ({ ...p, _dias: diasRestantes(p) }))
    .filter((p) => p._dias !== null && p._dias <= 10)
    .sort((a, b) => a._dias - b._dias)
    .slice(0, 6);

  return (
    <div>
      <SectionTitle
        icone="📊"
        titulo="Dashboard"
        sub="Visão geral dos procedimentos administrativos em andamento"
      />

      <div style={{
        display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        marginBottom: 24,
      }}>
        <CardKPI valor={total}      label="Total cadastrados" cor="#fbbf24" icone="📋" onClick={() => onIrPara('procedimentos')} />
        <CardKPI valor={ativos}     label="Em andamento"      cor="#3b82f6" icone="⚡" onClick={() => onIrPara('procedimentos')} />
        <CardKPI valor={dentro}     label="Dentro do prazo"   cor="#22c55e" icone="✓" />
        <CardKPI valor={proximo}    label="Próx. vencimento"  cor="#f59e0b" icone="⚠" />
        <CardKPI valor={vencido}    label="Vencidos"          cor="#ef4444" icone="✕" />
        <CardKPI valor={sobrestado} label="Sobrestados"       cor="#a855f7" icone="⏸" />
      </div>

      <div style={{
        display: 'grid', gap: 18,
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        marginBottom: 24,
      }}>
        {/* Pizza por status */}
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '18px 20px',
        }}>
          <h3 style={{
            color: '#b45309', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Distribuição por status
          </h3>
          {pieData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: 60, fontSize: 13 }}>
              Sem procedimentos ativos
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%"
                     innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#475569' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Barras por tipo */}
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '18px 20px',
        }}>
          <h3 style={{
            color: '#b45309', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            Procedimentos ativos por tipo
          </h3>
          {porTipo.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: 60, fontSize: 13 }}>
              Sem dados ainda
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porTipo} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nome" stroke="#64748b" fontSize={10}
                       angle={-15} textAnchor="end" height={56} interval={0} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }} />
                <Bar dataKey="quantidade" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Próximos vencimentos */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 14,
        }}>
          <h3 style={{
            color: '#b45309', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0,
          }}>
            ⏰ Próximos a vencer (≤ 10 dias)
          </h3>
          <button onClick={() => onIrPara('procedimentos')} style={btnGhost}>
            Ver todos →
          </button>
        </div>
        {proximosFim.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: 30, fontSize: 13 }}>
            Nenhum procedimento próximo do vencimento 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximosFim.map((p) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: 12,
                background: '#ffffff',
                padding: '10px 14px', borderRadius: 8,
                borderLeft: `3px solid ${
                  p._dias < 0 ? '#ef4444' :
                  p._dias <= 5 ? '#f59e0b' : '#22c55e'
                }`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 700 }}>
                    {p.tipo_nome} · Nº {p.numero}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    Encarregado: {p.encarregado_label || '—'} · Limite: {formatarData(calcDataLimite(p))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-heading" style={{
                    color: p._dias < 0 ? '#ef4444' :
                           p._dias <= 5 ? '#b45309' : '#22c55e',
                    fontWeight: 700, fontSize: 22, lineHeight: 1,
                  }}>
                    {p._dias < 0 ? `${Math.abs(p._dias)}` : p._dias}
                  </div>
                  <div style={{
                    color: '#64748b', fontSize: 9,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>
                    {p._dias < 0 ? 'dias atrasado' : 'dias restantes'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

