import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// ============================================================
// ESTILOS GLOBAIS
// ============================================================
const AZUL = '#0d2340';
const AZUL2 = '#1a3a5c';
const AZUL3 = '#1e4d7b';
const DOURADO = '#FFD700';
const VERDE = '#1B5E20';
const VERMELHO = '#B71C1C';
const ROXO = '#6A1B9A';
const LARANJA = '#E65100';
const CINZA = '#f0f2f5';

const inp = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0dce8', fontSize:14, color:'#1a3a5c', background:'#f8fafc', boxSizing:'border-box', outline:'none', fontFamily:'inherit' };
const lbl = { display:'block', fontSize:11, fontWeight:700, color:'#4a6580', marginBottom:5, textTransform:'uppercase', letterSpacing:0.5 };
const btnPrimary = { display:'block', width:'100%', padding:'12px', background:`linear-gradient(135deg,${AZUL},${AZUL3})`, color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer', marginTop:12, fontFamily:'inherit', letterSpacing:0.5 };
const btnSm = { padding:'6px 13px', borderRadius:7, fontWeight:600, fontSize:12, cursor:'pointer', border:'none', fontFamily:'inherit' };

function Card({ children, style }) {
  return <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 2px 12px #00000012', marginBottom:12, ...style }}>{children}</div>;
}
function Spinner() {
  return <div style={{ textAlign:'center', padding:40, color:'#6b8099', fontSize:15 }}>⏳ Carregando...</div>;
}
function StatCard({ label, value, color=AZUL, icon, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'16px 12px', boxShadow:'0 2px 12px #00000012', textAlign:'center', border:`2px solid ${color}18` }}>
      {icon && <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>}
      <div style={{ fontSize:28, fontWeight:900, color }}>{value}</div>
      <div style={{ fontSize:11, color:'#6b8099', fontWeight:600, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'#aab', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

const CORES_GRAD = ['#0D47A1','#1565C0','#1976D2','#1E88E5','#42A5F5','#E65100','#F57C00','#FB8C00','#FFA726','#B71C1C','#C62828'];
const CORES_APT = { 'Apto A':'#1B5E20', 'Apto B':'#F9A825', 'Apto C':'#B71C1C', 'LTS':'#6A1B9A', 'CD/CRD':'#E65100' };

// ============================================================
// TELA DE LOGIN
// ============================================================
function TelaLogin({ onLogin }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [abaLogin, setAbaLogin] = useState('comando');

  async function entrar() {
    if (!matricula || !senha) { setErro('Preencha todos os campos.'); return; }
    setLoading(true); setErro('');
    const { data, error } = await supabase.from('usuarios_secao').select('*').eq('matricula', matricula.trim());
    setLoading(false);
    if (error || !data || data.length === 0) { setErro('Usuário não encontrado.'); return; }
    const usuario = data[0];
    if (usuario.senha !== senha.trim()) { setErro('Senha incorreta.'); return; }
    onLogin(usuario);
  }

  return (
    <div style={{ minHeight:'100vh', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
      {/* FUNDO */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'url(/batalhao.jpg)', backgroundSize:'cover', backgroundPosition:'center 30%', filter:'brightness(0.3) saturate(0.7)' }} />
      <div style={{ position:'absolute', inset:0, background:`linear-gradient(160deg, rgba(13,35,64,0.80) 0%, rgba(30,77,123,0.60) 100%)` }} />

      {/* CARD */}
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:400, background:'#fff', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.4)', overflow:'hidden' }}>
        {/* TOPO */}
        <div style={{ background:`linear-gradient(135deg,${AZUL},${AZUL3})`, padding:'28px 32px 24px', textAlign:'center' }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:56, width:56, objectFit:'contain', marginBottom:12, borderRadius:8 }} />
          <h1 style={{ color:'#fff', fontWeight:800, fontSize:17, margin:0 }}>Painel do Comando</h1>
          <p style={{ color:'#8db4d8', fontSize:12, fontWeight:400, margin:'6px 0 0' }}>32º Batalhão de Polícia Militar</p>
        </div>

        {/* ABAS */}
        <div style={{ display:'flex', borderBottom:'2px solid #f0f2f5' }}>
          {[{ id:'comando', label:'🏛️ Comando / Seção' }, { id:'admin', label:'⚙️ Admin' }].map(a => (
            <button key={a.id} onClick={() => { setAbaLogin(a.id); setErro(''); }} style={{
              flex:1, padding:'13px 8px', fontWeight: abaLogin===a.id ? 700 : 500, fontSize:12,
              cursor:'pointer', border:'none', borderBottom: abaLogin===a.id ? `3px solid ${AZUL}` : '3px solid transparent',
              background:'#fff', color: abaLogin===a.id ? AZUL : '#6b8099', marginBottom:'-2px',
            }}>{a.label}</button>
          ))}
        </div>

        {/* FORM */}
        <div style={{ padding:'24px 32px 28px' }}>
          <p style={{ color:'#6b8099', fontSize:13, marginBottom:20, marginTop:0 }}>
            {abaLogin === 'admin' ? 'Acesso restrito ao administrador do sistema.' : 'Entre com sua matrícula e senha.'}
          </p>
          <label style={lbl}>Matrícula</label>
          <input value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex.: CMT001" style={{ ...inp, marginBottom:12 }} autoComplete="off" />
          <label style={lbl}>Senha</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key==='Enter'&&entrar()} placeholder="••••••" style={{ ...inp, marginBottom:6 }} />
          {erro && <p style={{ color:VERMELHO, fontSize:12, marginTop:4, marginBottom:0 }}>{erro}</p>}
          <button onClick={entrar} disabled={loading} style={{ ...btnPrimary, opacity:loading?0.7:1, textTransform:'uppercase' }}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </div>

        {/* RODAPÉ */}
        <div style={{ borderTop:'1px solid #f0f2f5', padding:'12px 32px', textAlign:'center' }}>
          <span style={{ fontSize:11, color:'#aab' }}>Polícia Militar do Estado do Rio de Janeiro · 32º BPM</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD COMANDANTE
// ============================================================
function DashboardComandante() {
  const [p1, setP1] = useState(null);
  const [p1apt, setP1apt] = useState(null);
  const [p1afast, setP1afast] = useState(null);
  const [p1grad, setP1grad] = useState([]);
  const [p1hist, setP1hist] = useState([]);
  const [p1cia, setP1cia] = useState([]);
  const [p4, setP4] = useState(null);
  const [p3stats, setP3stats] = useState(null);
  const [p3ops, setP3ops] = useState([]);
  const [p2, setP2] = useState(null);
  const [ajd, setAjd] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [secaoAtiva, setSecaoAtiva] = useState('geral');

  const carregar = useCallback(async () => {
    const [e, a, af, g, h, c, p4d, p3s, p3o, p2d, ajdd, agd] = await Promise.all([
      supabase.from('p1_efetivo').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('p1_aptidao').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('p1_afastamentos').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('p1_graduacoes').select('*').order('ordem'),
      supabase.from('p1_historico').select('*'),
      supabase.from('p1_afastamentos_cia').select('*'),
      supabase.from('p4_viaturas').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('p3_estatisticas').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('p3_ordens_policiamento').select('*').eq('ativa',true).order('data_fim'),
      supabase.from('p2_relins').select('*').order('updated_at',{ascending:false}).limit(1),
      supabase.from('ajd_processos').select('*').order('created_at',{ascending:false}),
      supabase.from('secretaria_agenda').select('*').gte('data', new Date().toISOString().split('T')[0]).order('data').limit(5),
    ]);
    setP1(e.data?.[0]); setP1apt(a.data?.[0]); setP1afast(af.data?.[0]);
    setP1grad(g.data||[]); setP1hist(h.data||[]); setP1cia(c.data||[]);
    setP4(p4d.data?.[0]); setP3stats(p3s.data?.[0]); setP3ops(p3o.data||[]);
    setP2(p2d.data?.[0]); setAjd(ajdd.data||[]); setAgenda(agd.data||[]);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <Spinner />;

  const mesAtual = new Date().toLocaleString('pt-BR',{month:'long',year:'numeric'});
  const aptData = p1apt ? [
    { name:'Apto A', value:p1apt.apto_a },
    { name:'Apto B', value:p1apt.apto_b },
    { name:'Apto C', value:p1apt.apto_c },
    { name:'LTS', value:p1apt.lts },
  ] : [];
  const ajdTram = ajd.filter(p => p.status === 'tramitacao');
  const ajdSol = ajd.filter(p => p.status === 'solucionado' && p.ano === new Date().getFullYear());

  const SECOES = [
    { id:'geral', label:'🏛️ Visão Geral' },
    { id:'p1', label:'👥 P1 — Pessoal' },
    { id:'p3', label:'🚔 P3 — Operações' },
    { id:'p4', label:'🚗 P4 — Viaturas' },
    { id:'p2', label:'🔍 P2' },
    { id:'ajd', label:'⚖️ AJD' },
    { id:'agenda', label:'📅 Agenda' },
  ];

  return (
    <div>
      {/* ABAS */}
      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {SECOES.map(s => (
          <button key={s.id} onClick={() => setSecaoAtiva(s.id)} style={{
            padding:'8px 14px', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:12,
            background: secaoAtiva===s.id ? AZUL : '#fff', color: secaoAtiva===s.id ? '#fff' : AZUL2,
            border:`1px solid ${secaoAtiva===s.id ? AZUL : '#d0dce8'}`,
          }}>{s.label}</button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {secaoAtiva === 'geral' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>📊 Panorama Geral — 32º BPM</h2>

          {/* Cards principais */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            <StatCard label="Efetivo Total" value={p1?.efetivo_total||'—'} color={AZUL} icon="👮" />
            <StatCard label="Disponíveis" value={p1?.efetivo_disponivel||'—'} color={VERDE} icon="✅" sub={p1?`${Math.round((p1.efetivo_disponivel/p1.efetivo_total)*100)}% do efetivo`:''} />
            <StatCard label="Afastados" value={p1afast?(p1afast.lts+p1afast.ferias+p1afast.licenca_especial+p1afast.suspensao_total+p1afast.preso+p1afast.aguardando_reserva):'—'} color={VERMELHO} icon="🚫" />
            <StatCard label="Viaturas OK" value={p4?.funcionando||'—'} color="#0D47A1" icon="🚗" sub={p4?`de ${p4.total} total`:''} />
          </div>

          {/* Segunda linha */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            <StatCard label="Apto B" value={p1apt?.apto_b||'—'} color="#F9A825" icon="🟡" />
            <StatCard label="Apto C" value={p1apt?.apto_c||'—'} color={VERMELHO} icon="🔴" />
            <StatCard label="Em LTS" value={p1apt?.lts||'—'} color={ROXO} icon="🏥" />
            <StatCard label="Relins/mês" value={p2?.quantidade||'—'} color={VERDE} icon="📋" sub={mesAtual} />
          </div>

          {/* P3 + AJD + Agenda lado a lado */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>🚔 P3 — Resultados do Mês</h3>
              {p3stats ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { l:'Prisões', v:p3stats.prisoes, c:VERMELHO },
                    { l:'Veículos Recuperados', v:p3stats.veiculos_recuperados, c:AZUL2 },
                    { l:'Maconha (kg)', v:p3stats.maconha_kg, c:VERDE },
                    { l:'Cocaína (kg)', v:p3stats.cocaina_kg, c:'#F9A825' },
                    { l:'Crack (kg)', v:p3stats.crack_kg, c:LARANJA },
                    { l:'OPs Ativas', v:p3ops.length, c:'#0D47A1' },
                  ].map(s => (
                    <div key={s.l} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:10, color:'#6b8099', fontWeight:600 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color:'#aab', fontSize:13 }}>Sem dados registrados.</p>}
            </Card>

            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>⚖️ AJD — Processos</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                {['DRD','IPM','AVERIGUACAO','RPM'].map(tipo => {
                  const tram = ajdTram.filter(p => p.tipo===tipo).length;
                  const sol = ajdSol.filter(p => p.tipo===tipo).length;
                  return (
                    <div key={tipo} style={{ background:'#f8fafc', borderRadius:8, padding:'8px', border:'1px solid #e0e8f0' }}>
                      <div style={{ fontWeight:800, color:AZUL, fontSize:11, marginBottom:4 }}>{tipo}</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <span style={{ background:'#FFF8E1', color:'#7B5800', borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{tram} tram.</span>
                        <span style={{ background:'#E8F5E9', color:VERDE, borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{sol} sol.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Agenda próximos compromissos */}
          <Card>
            <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>📅 Próximos Compromissos</h3>
            {agenda.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhum compromisso agendado.</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {agenda.map(a => (
                  <div key={a.id} style={{ display:'flex', gap:12, alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'10px 12px', border:'1px solid #e0e8f0' }}>
                    <div style={{ textAlign:'center', minWidth:44 }}>
                      <div style={{ fontSize:16, fontWeight:900, color:AZUL }}>{new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit'})}</div>
                      <div style={{ fontSize:10, color:'#6b8099', fontWeight:600 }}>{new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).toUpperCase()}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:AZUL, fontSize:13 }}>{a.titulo}</div>
                      {a.local && <div style={{ fontSize:11, color:'#6b8099' }}>📍 {a.local}</div>}
                      {a.hora_inicio && <div style={{ fontSize:11, color:'#6b8099' }}>🕐 {a.hora_inicio}{a.hora_fim?` — ${a.hora_fim}`:''}</div>}
                    </div>
                    <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{a.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* P1 PESSOAL */}
      {secaoAtiva === 'p1' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>👥 P1 — Pessoal</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            <StatCard label="Efetivo Total" value={p1?.efetivo_total||'—'} color={AZUL} />
            <StatCard label="Oficiais" value={p1?.oficiais||'—'} color={AZUL2} />
            <StatCard label="Praças" value={p1?.pracas||'—'} color={AZUL3} />
            <StatCard label="Disponíveis" value={p1?.efetivo_disponivel||'—'} color={VERDE} />
            <StatCard label="Afastados/Indisp." value={p1?(p1.efetivo_total-p1.efetivo_disponivel):'—'} color={VERMELHO} />
            <StatCard label="Período anterior" value={p1?.efetivo_anterior||'—'} color="#6b8099" sub={p1?`Variação: ${p1.efetivo_total-p1.efetivo_anterior}`:''} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Situação de Aptidão</h3>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                {aptData.map(a => (
                  <div key={a.name} style={{ background:(CORES_APT[a.name]||AZUL)+'18', borderRadius:10, padding:'10px 12px', textAlign:'center', border:`2px solid ${CORES_APT[a.name]||AZUL}`, flex:1, minWidth:70 }}>
                    <div style={{ fontSize:22, fontWeight:900, color:CORES_APT[a.name]||AZUL }}>{a.value}</div>
                    <div style={{ fontSize:10, color:'#6b8099', fontWeight:600 }}>{a.name}</div>
                  </div>
                ))}
              </div>
              {p1apt && (
                <div style={{ background:'#FFF3E0', borderRadius:8, padding:'8px 12px' }}>
                  <span style={{ fontWeight:700, color:LARANJA, fontSize:12 }}>⚠️ CD/CRD: {p1apt.cd_crd} policiais</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={aptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({name,value})=>`${name}: ${value}`} labelLine={false} fontSize={9}>
                    {aptData.map((e,i) => <Cell key={i} fill={CORES_APT[e.name]||AZUL} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Afastamentos</h3>
              {p1afast && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { l:'Férias', v:p1afast.ferias, c:'#0D47A1' },
                    { l:'LTS', v:p1afast.lts, c:ROXO },
                    { l:'Licença Especial', v:p1afast.licenca_especial, c:LARANJA },
                    { l:'Suspensão Total', v:p1afast.suspensao_total, c:VERMELHO },
                    { l:'Aguard. Reserva', v:p1afast.aguardando_reserva, c:'#37474F' },
                    { l:'Red. Carga Horária', v:p1afast.reducao_carga, c:'#00695C' },
                    { l:'Preso', v:p1afast.preso, c:VERMELHO },
                  ].map(s => (
                    <div key={s.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'#f8fafc', borderRadius:8 }}>
                      <span style={{ fontSize:12, color:AZUL2, fontWeight:500 }}>{s.l}</span>
                      <span style={{ fontWeight:800, color:s.c, fontSize:15 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Afastamentos por CIA/Seção</h3>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:AZUL }}>
                    {['Fração','Férias','LE','LTS','Suspensão','Preso','Total'].map(h => (
                      <th key={h} style={{ color:'#fff', padding:'8px 6px', fontWeight:700, textAlign:'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p1cia.map((c,i) => (
                    <tr key={c.id} style={{ background:i%2===0?'#fff':'#f8fafc' }}>
                      <td style={{ padding:'7px 8px', fontWeight:700, color:AZUL }}>{c.fracao}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{c.ferias}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{c.licenca_especial}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{c.lts}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{c.suspensao}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center' }}>{c.preso}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:800, color:VERMELHO }}>{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Distribuição por Graduação</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={p1grad} layout="vertical" margin={{ left:60, right:20 }}>
                  <XAxis type="number" tick={{ fontSize:10 }} />
                  <YAxis type="category" dataKey="graduacao" tick={{ fontSize:10 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="quantidade" radius={[0,4,4,0]}>
                    {p1grad.map((e,i) => <Cell key={i} fill={CORES_GRAD[i%CORES_GRAD.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Evolução Histórica</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={p1hist} margin={{ left:0, right:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize:9 }} />
                  <YAxis domain={[600,760]} tick={{ fontSize:10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="quantidade" stroke={AZUL3} strokeWidth={2} dot={{ r:4, fill:AZUL }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      )}

      {/* P3 OPERAÇÕES */}
      {secaoAtiva === 'p3' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>🚔 P3 — Operações</h2>
          {p3stats ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                <StatCard label="Prisões" value={p3stats.prisoes} color={VERMELHO} icon="🔒" />
                <StatCard label="Apreensões (pessoas)" value={p3stats.apreensoes_pessoas} color={LARANJA} icon="👤" />
                <StatCard label="Veículos Recuperados" value={p3stats.veiculos_recuperados} color={AZUL2} icon="🚗" />
                <StatCard label="Maconha (kg)" value={p3stats.maconha_kg} color={VERDE} icon="🌿" />
                <StatCard label="Cocaína (kg)" value={p3stats.cocaina_kg} color="#F9A825" icon="⚗️" />
                <StatCard label="Crack (kg)" value={p3stats.crack_kg} color={LARANJA} icon="🧪" />
              </div>
            </>
          ) : <Card><p style={{ color:'#aab', fontSize:13 }}>Nenhum dado registrado ainda.</p></Card>}

          <Card>
            <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>📋 Ordens de Policiamento Ativas</h3>
            {p3ops.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma OP ativa.</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {p3ops.map(op => {
                  const venc = op.data_fim ? new Date(op.data_fim+'T12:00:00') : null;
                  const dias = venc ? Math.ceil((venc-new Date())/(1000*60*60*24)) : null;
                  return (
                    <div key={op.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'10px 14px', border:'1px solid #e0e8f0', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:700, color:AZUL, fontSize:13 }}>OP {op.numero}</div>
                        {op.descricao && <div style={{ fontSize:12, color:'#6b8099' }}>{op.descricao}</div>}
                        {op.data_inicio && <div style={{ fontSize:11, color:'#aab' }}>Início: {new Date(op.data_inicio+'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {op.pdf_url && <a href={op.pdf_url} target="_blank" rel="noreferrer" style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, textDecoration:'none' }}>📄 Ver PDF</a>}
                        {dias !== null && (
                          <span style={{ background:dias<=7?'#FFEBEE':dias<=30?'#FFF8E1':'#E8F5E9', color:dias<=7?VERMELHO:dias<=30?'#7B5800':VERDE, borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700 }}>
                            {dias<0?'VENCIDA':dias===0?'Vence hoje':`${dias} dias`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* P4 VIATURAS */}
      {secaoAtiva === 'p4' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>🚗 P4 — Viaturas</h2>
          {p4 ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                <StatCard label="Total de Viaturas" value={p4.total} color={AZUL} icon="🚗" />
                <StatCard label="Em Funcionamento" value={p4.funcionando} color={VERDE} icon="✅" sub={p4.total?`${Math.round((p4.funcionando/p4.total)*100)}% da frota`:''} />
                <StatCard label="Baixadas" value={p4.baixadas} color={VERMELHO} icon="🔧" sub={p4.total?`${Math.round((p4.baixadas/p4.total)*100)}% da frota`:''} />
              </div>
              <Card>
                <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:14 }}>Situação da Frota</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[{name:'Funcionando',value:p4.funcionando},{name:'Baixadas',value:p4.baixadas}]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,value})=>`${name}: ${value}`}>
                      <Cell fill={VERDE} />
                      <Cell fill={VERMELHO} />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {p4.observacoes && <div style={{ background:'#f0f6ff', borderRadius:8, padding:'10px 14px', marginTop:12, fontSize:13, color:AZUL2 }}>📝 {p4.observacoes}</div>}
                <div style={{ marginTop:8, fontSize:11, color:'#aab', textAlign:'right' }}>Atualizado por: {p4.atualizado_por}</div>
              </Card>
            </>
          ) : <Card><p style={{ color:'#aab', fontSize:13 }}>Nenhum dado registrado ainda.</p></Card>}
        </div>
      )}

      {/* P2 */}
      {secaoAtiva === 'p2' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>🔍 P2 — Relins</h2>
          {p2 ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              <StatCard label="Relins produzidos" value={p2.quantidade} color={VERDE} icon="📋" sub={mesAtual} />
              {p2.observacoes && <Card><p style={{ fontSize:13, color:AZUL2 }}>📝 {p2.observacoes}</p></Card>}
            </div>
          ) : <Card><p style={{ color:'#aab', fontSize:13 }}>Nenhum dado registrado ainda.</p></Card>}
        </div>
      )}

      {/* AJD */}
      {secaoAtiva === 'ajd' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>⚖️ AJD — Assessoria Jurídica</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:'#7B5800', marginBottom:12 }}>⏳ Em Tramitação</h3>
              {['DRD','IPM','AVERIGUACAO','RPM'].map(tipo => {
                const itens = ajdTram.filter(p => p.tipo===tipo);
                return (
                  <div key={tipo} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:AZUL, fontSize:12 }}>{tipo}</span>
                      <span style={{ background:'#FFF8E1', color:'#7B5800', borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>{itens.length}</span>
                    </div>
                    {itens.map(p => <div key={p.id} style={{ fontSize:11, color:'#6b8099', padding:'3px 8px', background:'#f8fafc', borderRadius:6, marginBottom:2 }}>{p.numero||'Sem número'}{p.descricao?` — ${p.descricao}`:''}</div>)}
                  </div>
                );
              })}
            </Card>
            <Card>
              <h3 style={{ fontSize:13, fontWeight:800, color:VERDE, marginBottom:12 }}>✅ Solucionados em {new Date().getFullYear()}</h3>
              {['DRD','IPM','AVERIGUACAO','RPM'].map(tipo => {
                const itens = ajdSol.filter(p => p.tipo===tipo);
                return (
                  <div key={tipo} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#f8fafc', borderRadius:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:AZUL, fontSize:12 }}>{tipo}</span>
                    <span style={{ background:'#E8F5E9', color:VERDE, borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:800 }}>{itens.length}</span>
                  </div>
                );
              })}
            </Card>
          </div>
        </div>
      )}

      {/* AGENDA */}
      {secaoAtiva === 'agenda' && (
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>📅 Agenda do Comandante</h2>
          <Card>
            {agenda.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhum compromisso agendado.</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {agenda.map(a => (
                  <div key={a.id} style={{ display:'flex', gap:14, alignItems:'flex-start', background:'#f8fafc', borderRadius:10, padding:'12px 16px', border:'1px solid #e0e8f0' }}>
                    <div style={{ textAlign:'center', minWidth:48, background:AZUL, borderRadius:8, padding:'8px 4px' }}>
                      <div style={{ fontSize:18, fontWeight:900, color:'#fff' }}>{new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit'})}</div>
                      <div style={{ fontSize:9, color:'#8db4d8', fontWeight:600 }}>{new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).toUpperCase()}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:AZUL, fontSize:14 }}>{a.titulo}</div>
                      {a.descricao && <div style={{ fontSize:12, color:'#6b8099', marginTop:2 }}>{a.descricao}</div>}
                      <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                        {a.hora_inicio && <span style={{ fontSize:11, color:AZUL2 }}>🕐 {a.hora_inicio}{a.hora_fim?` — ${a.hora_fim}`:''}</span>}
                        {a.local && <span style={{ fontSize:11, color:AZUL2 }}>📍 {a.local}</span>}
                      </div>
                    </div>
                    <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{a.tipo}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELAS DE SEÇÃO
// ============================================================
function TelaSecao({ usuario, onSair }) {
  const secao = usuario.secao_sigla;
  const [aba, setAba] = useState('dados');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  function showMsg(texto, tipo='ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 3000);
  }

  // P4
  const [p4form, setP4form] = useState({ total:'', funcionando:'', baixadas:'', observacoes:'' });
  async function salvarP4() {
    setSalvando(true);
    const { error } = await supabase.from('p4_viaturas').insert({ ...p4form, atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro');
    else { showMsg('Dados salvos!'); setP4form({ total:'', funcionando:'', baixadas:'', observacoes:'' }); }
  }

  // P3 stats
  const [p3form, setP3form] = useState({ mes: new Date().getMonth()+1, ano: new Date().getFullYear(), prisoes:0, apreensoes_pessoas:0, maconha_kg:0, cocaina_kg:0, crack_kg:0, veiculos_recuperados:0 });
  async function salvarP3() {
    setSalvando(true);
    const { error } = await supabase.from('p3_estatisticas').insert({ ...p3form, atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro'); else showMsg('Estatísticas salvas!');
  }

  // P3 OP
  const [opForm, setOpForm] = useState({ numero:'', descricao:'', data_inicio:'', data_fim:'', pdf_url:'' });
  const [ops, setOps] = useState([]);
  useEffect(() => {
    if (secao==='P3') supabase.from('p3_ordens_policiamento').select('*').order('created_at',{ascending:false}).then(({data}) => setOps(data||[]));
  }, [secao]);
  async function salvarOP() {
    setSalvando(true);
    const { error } = await supabase.from('p3_ordens_policiamento').insert({ ...opForm, atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro');
    else { showMsg('OP cadastrada!'); setOpForm({ numero:'', descricao:'', data_inicio:'', data_fim:'', pdf_url:'' }); }
  }
  async function encerrarOP(id) {
    await supabase.from('p3_ordens_policiamento').update({ ativa:false }).eq('id',id);
    setOps(prev => prev.map(o => o.id===id ? {...o, ativa:false} : o));
  }

  // P2
  const [p2form, setP2form] = useState({ quantidade:'', observacoes:'' });
  async function salvarP2() {
    setSalvando(true);
    const { error } = await supabase.from('p2_relins').insert({ ...p2form, mes: new Date().getMonth()+1, ano: new Date().getFullYear(), atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro'); else showMsg('Relins salvos!');
  }

  // AJD
  const [ajdForm, setAjdForm] = useState({ tipo:'DRD', numero:'', descricao:'', status:'tramitacao', ano: new Date().getFullYear(), observacoes:'' });
  const [ajdLista, setAjdLista] = useState([]);
  useEffect(() => {
    if (secao==='AJD') supabase.from('ajd_processos').select('*').order('created_at',{ascending:false}).then(({data}) => setAjdLista(data||[]));
  }, [secao]);
  async function salvarAJD() {
    setSalvando(true);
    const { error } = await supabase.from('ajd_processos').insert({ ...ajdForm, atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro');
    else { showMsg('Processo cadastrado!'); const {data} = await supabase.from('ajd_processos').select('*').order('created_at',{ascending:false}); setAjdLista(data||[]); }
  }
  async function toggleStatusAJD(id, status) {
    const novo = status === 'tramitacao' ? 'solucionado' : 'tramitacao';
    await supabase.from('ajd_processos').update({ status:novo, data_solucao: novo==='solucionado'?new Date().toISOString().split('T')[0]:null }).eq('id',id);
    setAjdLista(prev => prev.map(p => p.id===id ? {...p, status:novo} : p));
  }

  // AGENDA (Secretaria)
  const [agdForm, setAgdForm] = useState({ titulo:'', descricao:'', data:'', hora_inicio:'', hora_fim:'', local:'', tipo:'reuniao' });
  const [agdLista, setAgdLista] = useState([]);
  useEffect(() => {
    if (secao==='SEC') supabase.from('secretaria_agenda').select('*').order('data').then(({data}) => setAgdLista(data||[]));
  }, [secao]);
  async function salvarAgenda() {
    if (!agdForm.titulo || !agdForm.data) { showMsg('Título e data são obrigatórios.','erro'); return; }
    setSalvando(true);
    const { error } = await supabase.from('secretaria_agenda').insert({ ...agdForm, atualizado_por: usuario.nome });
    setSalvando(false);
    if (error) showMsg('Erro ao salvar.','erro');
    else { showMsg('Compromisso adicionado!'); const {data} = await supabase.from('secretaria_agenda').select('*').order('data'); setAgdLista(data||[]); setAgdForm({ titulo:'', descricao:'', data:'', hora_inicio:'', hora_fim:'', local:'', tipo:'reuniao' }); }
  }
  async function removerAgenda(id) {
    if (!window.confirm('Remover este compromisso?')) return;
    await supabase.from('secretaria_agenda').delete().eq('id',id);
    setAgdLista(prev => prev.filter(a => a.id !== id));
  }

  // P1 Afastamentos
  const [p1form, setP1form] = useState({ efetivo_total:645, efetivo_anterior:670, oficiais:21, pracas:624, efetivo_disponivel:533 });
  const [p1aptForm, setP1aptForm] = useState({ apto_a:545, apto_b:55, apto_c:20, lts:25, cd_crd:23 });
  const [p1afastForm, setP1afastForm] = useState({ lts:25, ferias:41, licenca_especial:15, suspensao_total:14, preso:1, aguardando_reserva:16, reducao_carga:15 });
  async function salvarP1() {
    setSalvando(true);
    await Promise.all([
      supabase.from('p1_efetivo').insert({ ...p1form, atualizado_por: usuario.nome }),
      supabase.from('p1_aptidao').insert({ ...p1aptForm }),
      supabase.from('p1_afastamentos').insert({ ...p1afastForm }),
    ]);
    setSalvando(false);
    showMsg('Dados P1 atualizados!');
  }

  const ABAS = secao==='P4' ? [['dados','📊 Atualizar Dados']] :
               secao==='P3' ? [['dados','📊 Estatísticas'],['ops','📋 Ordens de Policiamento']] :
               secao==='P2' ? [['dados','📊 Relins']] :
               secao==='AJD' ? [['dados','⚖️ Processos']] :
               secao==='SEC' ? [['dados','📅 Agenda']] :
               secao==='P1' ? [['dados','👥 Efetivo'],['aptidao','🏥 Aptidão'],['afastamentos','📋 Afastamentos']] : [];

  const TITULOS = { P1:'P1 — Pessoal', P2:'P2', P3:'P3 — Operações', P4:'P4 — Viaturas', AJD:'AJD — Assessoria Jurídica', SEC:'Secretaria' };

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {ABAS.map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding:'8px 14px', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:12,
            background: aba===id ? AZUL : '#fff', color: aba===id ? '#fff' : AZUL2,
            border:`1px solid ${aba===id ? AZUL : '#d0dce8'}`,
          }}>{label}</button>
        ))}
      </div>

      {msg && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:msg.tipo==='ok'?VERDE:VERMELHO, color:'#fff', borderRadius:10, padding:'12px 20px', fontWeight:700, fontSize:14, boxShadow:'0 4px 20px #00000030' }}>
          {msg.texto}
        </div>
      )}

      {/* P4 */}
      {secao==='P4' && aba==='dados' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Atualizar Dados de Viaturas</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            {[['total','Total de Viaturas'],['funcionando','Em Funcionamento'],['baixadas','Baixadas']].map(([k,l]) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input type="number" min="0" value={p4form[k]} onChange={e => setP4form(f=>({...f,[k]:parseInt(e.target.value)||0}))} style={inp} />
              </div>
            ))}
          </div>
          <label style={lbl}>Observações</label>
          <textarea value={p4form.observacoes} onChange={e => setP4form(f=>({...f,observacoes:e.target.value}))} placeholder="Observações sobre a frota..." style={{ ...inp, minHeight:80, resize:'vertical', marginBottom:6 }} />
          <button onClick={salvarP4} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar Dados'}</button>
        </Card>
      )}

      {/* P3 STATS */}
      {secao==='P3' && aba==='dados' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Registrar Estatísticas Operacionais</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            {[
              ['prisoes','Prisões'],['apreensoes_pessoas','Apreensões (pessoas)'],
              ['maconha_kg','Maconha (kg)'],['cocaina_kg','Cocaína (kg)'],
              ['crack_kg','Crack (kg)'],['veiculos_recuperados','Veículos Recuperados'],
            ].map(([k,l]) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input type="number" min="0" step={k.includes('kg')?'0.01':'1'} value={p3form[k]} onChange={e => setP3form(f=>({...f,[k]:parseFloat(e.target.value)||0}))} style={inp} />
              </div>
            ))}
          </div>
          <button onClick={salvarP3} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar Estatísticas'}</button>
        </Card>
      )}

      {/* P3 OPS */}
      {secao==='P3' && aba==='ops' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Cadastrar Ordem de Policiamento</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Número da OP *</label><input value={opForm.numero} onChange={e=>setOpForm(f=>({...f,numero:e.target.value}))} placeholder="Ex.: 001/2026" style={inp} /></div>
              <div><label style={lbl}>Descrição</label><input value={opForm.descricao} onChange={e=>setOpForm(f=>({...f,descricao:e.target.value}))} placeholder="Operação..." style={inp} /></div>
              <div><label style={lbl}>Data Início</label><input type="date" value={opForm.data_inicio} onChange={e=>setOpForm(f=>({...f,data_inicio:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>Data Fim / Vigência</label><input type="date" value={opForm.data_fim} onChange={e=>setOpForm(f=>({...f,data_fim:e.target.value}))} style={inp} /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Link do PDF (opcional)</label><input value={opForm.pdf_url} onChange={e=>setOpForm(f=>({...f,pdf_url:e.target.value}))} placeholder="https://..." style={inp} /></div>
            </div>
            <button onClick={salvarOP} disabled={salvando} style={{ ...btnPrimary, marginTop:4 }}>{salvando?'Salvando...':'➕ Cadastrar OP'}</button>
          </Card>
          <Card>
            <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>OPs Cadastradas</h3>
            {ops.length === 0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhuma OP cadastrada.</p> : ops.map(op => (
              <div key={op.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'10px 14px', marginBottom:8, border:`1px solid ${op.ativa?'#e0e8f0':'#EF9A9A'}` }}>
                <div>
                  <span style={{ fontWeight:700, color:AZUL, fontSize:13 }}>OP {op.numero}</span>
                  {op.descricao && <span style={{ fontSize:12, color:'#6b8099', marginLeft:8 }}>{op.descricao}</span>}
                  {op.data_fim && <div style={{ fontSize:11, color:'#aab' }}>Vigência até: {new Date(op.data_fim+'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {op.pdf_url && <a href={op.pdf_url} target="_blank" rel="noreferrer" style={{ ...btnSm, background:'#E3F2FD', color:'#0D47A1' }}>📄 PDF</a>}
                  {op.ativa && <button onClick={() => encerrarOP(op.id)} style={{ ...btnSm, background:'#FFEBEE', color:VERMELHO }}>Encerrar</button>}
                  {!op.ativa && <span style={{ fontSize:11, color:VERMELHO, fontWeight:700 }}>ENCERRADA</span>}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* P2 */}
      {secao==='P2' && aba==='dados' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Registrar Relins do Mês</h3>
          <label style={lbl}>Quantidade de Relins produzidos</label>
          <input type="number" min="0" value={p2form.quantidade} onChange={e=>setP2form(f=>({...f,quantidade:parseInt(e.target.value)||0}))} style={{ ...inp, marginBottom:12 }} />
          <label style={lbl}>Observações</label>
          <textarea value={p2form.observacoes} onChange={e=>setP2form(f=>({...f,observacoes:e.target.value}))} placeholder="Observações..." style={{ ...inp, minHeight:80, resize:'vertical', marginBottom:6 }} />
          <button onClick={salvarP2} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar'}</button>
        </Card>
      )}

      {/* AJD */}
      {secao==='AJD' && aba==='dados' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Cadastrar Processo</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Tipo *</label>
                <select value={ajdForm.tipo} onChange={e=>setAjdForm(f=>({...f,tipo:e.target.value}))} style={inp}>
                  {['DRD','IPM','AVERIGUACAO','RPM'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Número</label><input value={ajdForm.numero} onChange={e=>setAjdForm(f=>({...f,numero:e.target.value}))} placeholder="Ex.: 001/2026" style={inp} /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Descrição</label><input value={ajdForm.descricao} onChange={e=>setAjdForm(f=>({...f,descricao:e.target.value}))} placeholder="Descrição resumida..." style={inp} /></div>
              <div>
                <label style={lbl}>Status</label>
                <select value={ajdForm.status} onChange={e=>setAjdForm(f=>({...f,status:e.target.value}))} style={inp}>
                  <option value="tramitacao">Em Tramitação</option>
                  <option value="solucionado">Solucionado</option>
                </select>
              </div>
              <div><label style={lbl}>Ano</label><input type="number" value={ajdForm.ano} onChange={e=>setAjdForm(f=>({...f,ano:parseInt(e.target.value)}))} style={inp} /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Observações</label><textarea value={ajdForm.observacoes} onChange={e=>setAjdForm(f=>({...f,observacoes:e.target.value}))} style={{ ...inp, minHeight:70, resize:'vertical' }} /></div>
            </div>
            <button onClick={salvarAJD} disabled={salvando} style={{ ...btnPrimary, marginTop:4 }}>{salvando?'Salvando...':'➕ Cadastrar Processo'}</button>
          </Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {['tramitacao','solucionado'].map(status => (
              <Card key={status}>
                <h3 style={{ fontSize:13, fontWeight:800, color:status==='tramitacao'?'#7B5800':VERDE, marginBottom:12 }}>
                  {status==='tramitacao'?'⏳ Em Tramitação':'✅ Solucionados'}
                </h3>
                {ajdLista.filter(p=>p.status===status).length===0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhum.</p> :
                  ajdLista.filter(p=>p.status===status).map(p => (
                    <div key={p.id} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px', marginBottom:6, border:'1px solid #e0e8f0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <span style={{ fontWeight:700, color:AZUL, fontSize:12 }}>{p.tipo}</span>
                          {p.numero && <span style={{ fontSize:11, color:'#6b8099', marginLeft:6 }}>{p.numero}</span>}
                          {p.descricao && <div style={{ fontSize:11, color:'#6b8099' }}>{p.descricao}</div>}
                        </div>
                        <button onClick={() => toggleStatusAJD(p.id, p.status)} style={{ ...btnSm, background:status==='tramitacao'?'#E8F5E9':'#FFF8E1', color:status==='tramitacao'?VERDE:'#7B5800', fontSize:10 }}>
                          {status==='tramitacao'?'✅ Resolver':'↩️ Reabrir'}
                        </button>
                      </div>
                    </div>
                  ))
                }
              </Card>
            ))}
          </div>
        </>
      )}

      {/* SECRETARIA AGENDA */}
      {secao==='SEC' && aba==='dados' && (
        <>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Adicionar Compromisso</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Título *</label><input value={agdForm.titulo} onChange={e=>setAgdForm(f=>({...f,titulo:e.target.value}))} placeholder="Reunião, evento..." style={inp} /></div>
              <div><label style={lbl}>Data *</label><input type="date" value={agdForm.data} onChange={e=>setAgdForm(f=>({...f,data:e.target.value}))} style={inp} /></div>
              <div>
                <label style={lbl}>Tipo</label>
                <select value={agdForm.tipo} onChange={e=>setAgdForm(f=>({...f,tipo:e.target.value}))} style={inp}>
                  {['reuniao','evento','compromisso','visita','formatura','outro'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Hora Início</label><input type="time" value={agdForm.hora_inicio} onChange={e=>setAgdForm(f=>({...f,hora_inicio:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>Hora Fim</label><input type="time" value={agdForm.hora_fim} onChange={e=>setAgdForm(f=>({...f,hora_fim:e.target.value}))} style={inp} /></div>
              <div><label style={lbl}>Local</label><input value={agdForm.local} onChange={e=>setAgdForm(f=>({...f,local:e.target.value}))} placeholder="Local do compromisso" style={inp} /></div>
              <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Descrição</label><textarea value={agdForm.descricao} onChange={e=>setAgdForm(f=>({...f,descricao:e.target.value}))} style={{ ...inp, minHeight:70, resize:'vertical' }} /></div>
            </div>
            <button onClick={salvarAgenda} disabled={salvando} style={{ ...btnPrimary, marginTop:4 }}>{salvando?'Salvando...':'➕ Adicionar'}</button>
          </Card>
          <Card>
            <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>Agenda Cadastrada</h3>
            {agdLista.length===0 ? <p style={{ color:'#aab', fontSize:13 }}>Nenhum compromisso.</p> :
              agdLista.map(a => (
                <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'10px 14px', marginBottom:8, border:'1px solid #e0e8f0' }}>
                  <div>
                    <div style={{ fontWeight:700, color:AZUL, fontSize:13 }}>{a.titulo}</div>
                    <div style={{ fontSize:11, color:'#6b8099' }}>📅 {new Date(a.data+'T12:00:00').toLocaleDateString('pt-BR')} {a.hora_inicio?`· 🕐 ${a.hora_inicio}`:''} {a.local?`· 📍 ${a.local}`:''}</div>
                  </div>
                  <button onClick={() => removerAgenda(a.id)} style={{ ...btnSm, background:'#FFEBEE', color:VERMELHO }}>Remover</button>
                </div>
              ))
            }
          </Card>
        </>
      )}

      {/* P1 */}
      {secao==='P1' && aba==='dados' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Atualizar Efetivo Geral</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            {[['efetivo_total','Efetivo Total'],['efetivo_anterior','Período Anterior'],['oficiais','Oficiais'],['pracas','Praças'],['efetivo_disponivel','Disponíveis']].map(([k,l]) => (
              <div key={k}><label style={lbl}>{l}</label><input type="number" min="0" value={p1form[k]} onChange={e=>setP1form(f=>({...f,[k]:parseInt(e.target.value)||0}))} style={inp} /></div>
            ))}
          </div>
          <button onClick={salvarP1} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar'}</button>
        </Card>
      )}

      {secao==='P1' && aba==='aptidao' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Atualizar Situação de Aptidão</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            {[['apto_a','Apto A'],['apto_b','Apto B'],['apto_c','Apto C'],['lts','LTS'],['cd_crd','CD/CRD']].map(([k,l]) => (
              <div key={k}><label style={lbl}>{l}</label><input type="number" min="0" value={p1aptForm[k]} onChange={e=>setP1aptForm(f=>({...f,[k]:parseInt(e.target.value)||0}))} style={inp} /></div>
            ))}
          </div>
          <button onClick={salvarP1} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar'}</button>
        </Card>
      )}

      {secao==='P1' && aba==='afastamentos' && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>Atualizar Afastamentos</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            {[['lts','LTS'],['ferias','Férias'],['licenca_especial','Lic. Especial'],['suspensao_total','Suspensão Total'],['preso','Preso'],['aguardando_reserva','Aguard. Reserva'],['reducao_carga','Red. Carga Horária']].map(([k,l]) => (
              <div key={k}><label style={lbl}>{l}</label><input type="number" min="0" value={p1afastForm[k]} onChange={e=>setP1afastForm(f=>({...f,[k]:parseInt(e.target.value)||0}))} style={inp} /></div>
            ))}
          </div>
          <button onClick={salvarP1} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Salvando...':'💾 Salvar'}</button>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// PAINEL ADMIN
// ============================================================
function PainelAdmin() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome:'', matricula:'', senha:'', secao_sigla:'', nivel:'chefe' });
  const [msg, setMsg] = useState(null);
  const SECOES_OPTS = ['P1','P2','P3','P4','P5','AJD','SEC'];

  useEffect(() => {
    supabase.from('usuarios_secao').select('*').order('created_at').then(({data}) => setUsuarios(data||[]));
  }, []);

  function showMsg(texto, tipo='ok') { setMsg({texto,tipo}); setTimeout(()=>setMsg(null),3000); }

  async function cadastrar() {
    if (!form.nome || !form.matricula || !form.senha) { showMsg('Preencha todos os campos.','erro'); return; }
    const { data, error } = await supabase.from('usuarios_secao').insert({ ...form, secao_sigla: form.secao_sigla||null }).select().single();
    if (error) { showMsg('Erro: '+error.message,'erro'); return; }
    setUsuarios(prev => [...prev, data]);
    setForm({ nome:'', matricula:'', senha:'', secao_sigla:'', nivel:'chefe' });
    showMsg('Usuário cadastrado!');
  }

  async function remover(id) {
    if (!window.confirm('Remover este usuário?')) return;
    await supabase.from('usuarios_secao').delete().eq('id',id);
    setUsuarios(prev => prev.filter(u => u.id !== id));
  }

  async function resetarSenha(id) {
    const nova = prompt('Nova senha:');
    if (!nova) return;
    await supabase.from('usuarios_secao').update({ senha:nova }).eq('id',id);
    showMsg('Senha redefinida!');
  }

  const NIVEL_BADGE = { admin:{bg:'#0d2340',cor:'#fff',label:'ADMIN'}, comandante:{bg:VERDE,cor:'#fff',label:'CMT'}, chefe:{bg:'#f0f4f8',cor:AZUL2,label:'CHEFE'} };

  return (
    <div>
      <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, marginBottom:16 }}>⚙️ Painel Administrativo</h2>
      {msg && <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:msg.tipo==='ok'?VERDE:VERMELHO, color:'#fff', borderRadius:10, padding:'12px 20px', fontWeight:700 }}>{msg.texto}</div>}

      <Card>
        <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:16 }}>➕ Cadastrar Usuário</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nome completo *</label><input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex.: CAP PM SILVA" style={inp} /></div>
          <div><label style={lbl}>Matrícula *</label><input value={form.matricula} onChange={e=>setForm(f=>({...f,matricula:e.target.value}))} placeholder="Ex.: p3chefe" style={inp} /></div>
          <div><label style={lbl}>Senha *</label><input value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))} placeholder="Senha de acesso" style={inp} /></div>
          <div>
            <label style={lbl}>Seção</label>
            <select value={form.secao_sigla} onChange={e=>setForm(f=>({...f,secao_sigla:e.target.value}))} style={inp}>
              <option value="">— Selecionar —</option>
              {SECOES_OPTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nível de acesso</label>
            <select value={form.nivel} onChange={e=>setForm(f=>({...f,nivel:e.target.value}))} style={inp}>
              <option value="chefe">Chefe de Seção</option>
              <option value="comandante">Comandante</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button onClick={cadastrar} style={{ ...btnPrimary, marginTop:4 }}>Cadastrar</button>
      </Card>

      <Card>
        <h3 style={{ fontSize:13, fontWeight:800, color:AZUL, marginBottom:12 }}>Usuários Cadastrados ({usuarios.length})</h3>
        {usuarios.map(u => {
          const nb = NIVEL_BADGE[u.nivel] || NIVEL_BADGE.chefe;
          return (
            <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', borderRadius:8, padding:'10px 14px', marginBottom:8, border:'1px solid #e0e8f0', flexWrap:'wrap', gap:8 }}>
              <div>
                <span style={{ fontWeight:700, color:AZUL, fontSize:13 }}>{u.nome}</span>
                <span style={{ color:'#6b8099', fontSize:12, marginLeft:8 }}>@{u.matricula}</span>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <span style={{ background:nb.bg, color:nb.cor, borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:700 }}>{nb.label}</span>
                  {u.secao_sigla && <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:700 }}>{u.secao_sigla}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => resetarSenha(u.id)} style={{ ...btnSm, background:'#FFF8E1', color:'#7B5800' }}>🔑 Senha</button>
                {u.nivel !== 'admin' && <button onClick={() => remover(u.id)} style={{ ...btnSm, background:'#FFEBEE', color:VERMELHO }}>Remover</button>}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ============================================================
// TROCAR SENHA
// ============================================================
function TrocarSenha({ usuario, onVoltar, onSucesso }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    if (!senhaAtual || !novaSenha || !confirma) { setErro('Preencha todos os campos.'); return; }
    if (senhaAtual !== usuario.senha) { setErro('Senha atual incorreta.'); return; }
    if (novaSenha.length < 4) { setErro('Nova senha deve ter no mínimo 4 caracteres.'); return; }
    if (novaSenha !== confirma) { setErro('As senhas não coincidem.'); return; }
    setSalvando(true);
    const { error } = await supabase.from('usuarios_secao').update({ senha: novaSenha }).eq('id', usuario.id);
    setSalvando(false);
    if (error) { setErro('Erro ao salvar. Tente novamente.'); return; }
    onSucesso();
  }

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, margin:0 }}>🔑 Alterar Senha</h2>
        <button onClick={onVoltar} style={{ ...btnSm, background:'#f0f4f8', color:AZUL2 }}>← Voltar</button>
      </div>
      <p style={{ color:'#6b8099', fontSize:13, marginBottom:16 }}>Conectado como: <strong>{usuario.nome}</strong></p>
      <label style={lbl}>Senha atual</label>
      <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="••••••" style={{ ...inp, marginBottom:12 }} />
      <label style={lbl}>Nova senha</label>
      <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom:12 }} />
      <label style={lbl}>Confirmar nova senha</label>
      <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="Repita a nova senha" onKeyDown={e => e.key==='Enter'&&salvar()} style={{ ...inp, marginBottom:6 }} />
      {erro && <p style={{ color:VERMELHO, fontSize:12, marginBottom:4 }}>{erro}</p>}
      <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity:salvando?0.7:1 }}>{salvando?'Salvando...':'Salvar Nova Senha'}</button>
    </Card>
  );
}

// ============================================================
// TELA DE MENSAGENS
// ============================================================
function TelaMensagens({ usuario, ehComandante, msgs, setMsgs, onVoltar, onSucesso }) {
  const [form, setForm] = useState({ titulo:'', texto:'', destinatario:'todos' });
  const [salvando, setSalvando] = useState(false);
  const SECOES_OPTS = ['todos','P1','P2','P3','P4','P5','AJD','SEC'];

  async function enviar() {
    if (!form.titulo || !form.texto) { onSucesso('Preencha título e mensagem.', 'erro'); return; }
    setSalvando(true);
    const { data, error } = await supabase.from('mensagens_comando').insert({
      ...form, atualizado_por: usuario.nome, lida_por: []
    }).select().single();
    setSalvando(false);
    if (error) { onSucesso('Erro ao enviar.', 'erro'); return; }
    setMsgs(prev => [data, ...prev]);
    setForm({ titulo:'', texto:'', destinatario:'todos' });
    onSucesso('✅ Mensagem enviada!');
  }

  async function marcarLida(msg) {
    if ((msg.lida_por||[]).includes(usuario.id)) return;
    const novaLista = [...(msg.lida_por||[]), usuario.id];
    await supabase.from('mensagens_comando').update({ lida_por: novaLista }).eq('id', msg.id);
    setMsgs(prev => prev.map(m => m.id===msg.id ? {...m, lida_por:novaLista} : m));
  }

  async function remover(id) {
    if (!window.confirm('Remover esta mensagem?')) return;
    await supabase.from('mensagens_comando').delete().eq('id', id);
    setMsgs(prev => prev.filter(m => m.id !== id));
  }

  const msgsFiltradas = msgs.filter(m => m.destinatario === 'todos' || m.destinatario === usuario.secao_sigla || ehComandante);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:AZUL, margin:0 }}>📨 Mensagens do Comando</h2>
        <button onClick={onVoltar} style={{ ...btnSm, background:'#f0f4f8', color:AZUL2 }}>← Voltar</button>
      </div>

      {/* ENVIAR — só Comandante e Admin */}
      {ehComandante && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:14 }}>📤 Enviar Mensagem</h3>
          <label style={lbl}>Destinatário</label>
          <select value={form.destinatario} onChange={e => setForm(f=>({...f,destinatario:e.target.value}))} style={{ ...inp, marginBottom:10 }}>
            {SECOES_OPTS.map(s => <option key={s} value={s}>{s === 'todos' ? '📢 Todos os chefes de seção' : s}</option>)}
          </select>
          <label style={lbl}>Título *</label>
          <input value={form.titulo} onChange={e => setForm(f=>({...f,titulo:e.target.value}))} placeholder="Assunto da mensagem..." style={{ ...inp, marginBottom:10 }} />
          <label style={lbl}>Mensagem *</label>
          <textarea value={form.texto} onChange={e => setForm(f=>({...f,texto:e.target.value}))} placeholder="Digite sua mensagem..." style={{ ...inp, minHeight:100, resize:'vertical', marginBottom:6 }} />
          <button onClick={enviar} disabled={salvando} style={{ ...btnPrimary, marginTop:8 }}>{salvando?'Enviando...':'📤 Enviar Mensagem'}</button>
        </Card>
      )}

      {/* LISTA DE MENSAGENS */}
      <div>
        <h3 style={{ fontSize:14, fontWeight:800, color:AZUL, marginBottom:12 }}>📬 Caixa de Mensagens</h3>
        {msgsFiltradas.length === 0 ? (
          <Card><p style={{ color:'#aab', fontSize:13 }}>Nenhuma mensagem.</p></Card>
        ) : msgsFiltradas.map(m => {
          const lida = (m.lida_por||[]).includes(usuario.id);
          return (
            <div key={m.id} onClick={() => marcarLida(m)} style={{
              background: lida ? '#fff' : '#FFFDE7',
              borderRadius:10, padding:'14px 16px', marginBottom:10,
              boxShadow:'0 2px 8px #00000012',
              border: lida ? '1px solid #e0e8f0' : '2px solid #FFD54F',
              cursor:'pointer'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    {!lida && <span style={{ background:VERMELHO, color:'#fff', borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:800 }}>NOVA</span>}
                    <span style={{ background:'#E3F2FD', color:'#0D47A1', borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:700 }}>
                      Para: {m.destinatario === 'todos' ? 'Todos' : m.destinatario}
                    </span>
                    <span style={{ fontSize:11, color:'#aab' }}>{new Date(m.created_at).toLocaleDateString('pt-BR')} às {new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div style={{ fontWeight:700, color:AZUL, fontSize:14, marginBottom:6 }}>{m.titulo}</div>
                  <div style={{ fontSize:13, color:'#2d4a63', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{m.texto}</div>
                  <div style={{ fontSize:11, color:'#aab', marginTop:6 }}>Enviado por: {m.atualizado_por}</div>
                </div>
                {ehComandante && (
                  <button onClick={e => { e.stopPropagation(); remover(m.id); }} style={{ ...btnSm, background:'#FFEBEE', color:VERMELHO, flexShrink:0 }}>🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [abaPrincipal, setAbaPrincipal] = useState('principal');
  const [msgsSistema, setMsgsSistema] = useState([]);
  const [toastGlobal, setToastGlobal] = useState(null);

  useEffect(() => {
    try { const u = sessionStorage.getItem('cmd_usuario'); if (u) setUsuario(JSON.parse(u)); } catch(e){}
  }, []);

  useEffect(() => {
    if (usuario) {
      supabase.from('mensagens_comando').select('*').order('created_at', { ascending:false }).limit(10)
        .then(({ data }) => setMsgsSistema(data||[]));
    }
  }, [usuario]);

  function showToastGlobal(texto, tipo='ok') {
    setToastGlobal({ texto, tipo });
    setTimeout(() => setToastGlobal(null), 3000);
  }

  function onLogin(u) { try { sessionStorage.setItem('cmd_usuario', JSON.stringify(u)); } catch(e){} setUsuario(u); }
  function sair() { try { sessionStorage.removeItem('cmd_usuario'); } catch(e){} setUsuario(null); }

  const ehComandante = usuario?.nivel === 'comandante';
  const ehAdmin = usuario?.nivel === 'admin';
  const ehChefe = usuario?.nivel === 'chefe';

  // Mensagens não lidas
  const msgsNaoLidas = msgsSistema.filter(m =>
    (m.destinatario === 'todos' || m.destinatario === usuario?.secao_sigla) &&
    !(m.lida_por||[]).includes(usuario?.id)
  );

  if (!usuario) return (
    <div style={{ minHeight:'100vh', background:CINZA, fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <TelaLogin onLogin={onLogin} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:CINZA, fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {toastGlobal && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:toastGlobal.tipo==='ok'?VERDE:VERMELHO, color:'#fff', borderRadius:10, padding:'12px 20px', fontWeight:700, fontSize:14, boxShadow:'0 4px 20px #00000030' }}>
          {toastGlobal.texto}
        </div>
      )}

      {/* CABEÇALHO */}
      <div style={{ background:`linear-gradient(135deg,${AZUL} 0%,${AZUL2} 60%,${AZUL3} 100%)`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 4px 20px #00000040' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/logo.jpeg" alt="32 BPM" style={{ height:40, width:40, objectFit:'contain' }} />
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:0.3 }}>
              {ehAdmin ? '⚙️ Administração' : ehComandante ? '🏛️ Painel do Comando' : `${usuario.secao_sigla} — Painel da Seção`}
            </div>
            <div style={{ color:'#8db4d8', fontSize:11 }}>32º BPM · {usuario.nome}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setAbaPrincipal(abaPrincipal==='mensagens'?'principal':'mensagens')} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600, position:'relative' }}>
            📨 Mensagens
            {msgsNaoLidas.length > 0 && <span style={{ position:'absolute', top:-6, right:-6, background:VERMELHO, color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{msgsNaoLidas.length}</span>}
          </button>
          <button onClick={() => setAbaPrincipal(abaPrincipal==='senha'?'principal':'senha')} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>🔑 Senha</button>
          <button onClick={sair} style={{ background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>← Sair</button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ maxWidth:900, margin:'28px auto', padding:'0 14px' }}>

        {/* TROCAR SENHA */}
        {abaPrincipal === 'senha' && (
          <TrocarSenha usuario={usuario} onVoltar={() => setAbaPrincipal('principal')} onSucesso={() => { showToastGlobal('✅ Senha alterada!'); setAbaPrincipal('principal'); }} />
        )}

        {/* MENSAGENS */}
        {abaPrincipal === 'mensagens' && (
          <TelaMensagens usuario={usuario} ehComandante={ehComandante||ehAdmin} msgs={msgsSistema} setMsgs={setMsgsSistema} onVoltar={() => setAbaPrincipal('principal')} onSucesso={showToastGlobal} />
        )}

        {/* PRINCIPAL */}
        {abaPrincipal === 'principal' && (
          <>
            {msgsNaoLidas.length > 0 && (
              <div style={{ background:'#FFF8E1', border:'2px solid #FFD54F', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, color:'#7B5800', fontSize:13 }}>📨 Você tem {msgsNaoLidas.length} mensagem{msgsNaoLidas.length>1?'s':''} não lida{msgsNaoLidas.length>1?'s':''} do Comando!</span>
                <button onClick={() => setAbaPrincipal('mensagens')} style={{ ...btnSm, background:'#7B5800', color:'#fff' }}>Ver mensagens</button>
              </div>
            )}
            {ehAdmin && <PainelAdmin />}
            {ehComandante && <DashboardComandante />}
            {ehChefe && <TelaSecao usuario={usuario} />}
          </>
        )}
      </div>
    </div>
  );
}
