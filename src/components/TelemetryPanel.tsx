import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Zap, ShieldCheck, AlertTriangle, Crosshair, TrendingUp, Cpu } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const qData = [
  { time: '10:00', qCount: 120 },
  { time: '10:05', qCount: 132 },
  { time: '10:10', qCount: 101 },
  { time: '10:15', qCount: 143 },
  { time: '10:20', qCount: 90 },
  { time: '10:25', qCount: 210 },
  { time: '10:30', qCount: 110 },
];

const riskData = [
  { subject: 'EWM Subsystem', A: 120, fullMark: 150 },
  { subject: 'TM Subsystem', A: 98, fullMark: 150 },
  { subject: 'PP Subsystem', A: 86, fullMark: 150 },
  { subject: 'MM/SD Flow', A: 50, fullMark: 150 },
  { subject: 'Integration', A: 110, fullMark: 150 },
  { subject: 'SLA Risk', A: 65, fullMark: 150 },
];

export function TelemetryPanel() {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-[340px] bg-[#02040a]/95 backdrop-blur-3xl border-l border-white/5 hidden xl:flex flex-col shrink-0 relative z-20">
      <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent"></div>
      
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
        <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] text-slate-400 uppercase flex items-center">
          <Crosshair size={12} className="mr-2 text-emerald-400 animate-pulse" />
          Neural Telemetry Link
        </h2>
        <span className="text-[9px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 font-mono flex items-center bg-emerald-500/10">
          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 glow-text-emerald mr-1.5 transition-opacity duration-300 ${pulse ? 'opacity-100 shadow-[0_0_8px_#10b981]' : 'opacity-40'}`}></span>
          QUANTUM SYNC
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        
        {/* Real-time Predictive Alerts */}
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 relative overflow-hidden shadow-[0_0_30px_rgba(244,63,94,0.1)] hover:border-rose-500/50 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/15 rounded-bl-full filter blur-[20px] group-hover:bg-rose-500/25 transition-all duration-500"></div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <AlertTriangle size={16} className="text-rose-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-rose-400 uppercase font-bold glow-text-rose glitch-hover">Temporal Anomaly Predicted</span>
          </div>
          <p className="text-[11px] text-slate-200 font-mono leading-relaxed relative z-10">
            <span className="text-rose-300">99.2% PROBABILITY:</span> Freight Order settlement collapse detected in timeline horizon T+45m due to intersecting EWM Goods Issue block pattern.
          </p>
          <div className="mt-3 relative z-10">
              <button className="text-[9px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1.5 rounded font-mono border border-rose-500/40 transition-colors uppercase tracking-widest w-full text-center">
                 Initiate Auto-Heal Protocol
              </button>
          </div>
        </div>

        {/* Global Operational Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-xl border-white/5 cyber-border relative group hover:border-cyan-500/40 transition-colors duration-300">
             <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
             <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2 group-hover:text-cyan-400 transition-colors flex items-center justify-between">
                <span>EWM Kinematics</span>
                <Activity size={10} className="text-cyan-500/50"/>
             </div>
             <div className="text-3xl font-display text-slate-100 glow-text-white">14.2<span className="text-xs text-slate-500 ml-1">k/s</span></div>
             <div className="flex items-center text-[10px] text-emerald-400 mt-2 font-mono bg-emerald-500/10 inline-flex px-1.5 py-0.5 rounded border border-emerald-500/20">
               <TrendingUp size={10} className="mr-1" /> +2.4% /hr
             </div>
          </div>
          <div className="glass-card p-4 rounded-xl border-white/5 cyber-border relative group hover:border-amber-500/40 transition-colors duration-300">
             <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
             <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2 group-hover:text-amber-400 transition-colors flex items-center justify-between">
                <span>TM Routing Yield</span>
                <Activity size={10} className="text-amber-500/50"/>
             </div>
             <div className="text-3xl font-display text-amber-400 glow-text-amber">842<span className="text-xs text-slate-500 ml-1 opacity-50">/1000</span></div>
             <div className="flex items-center text-[10px] text-rose-400 mt-2 font-mono bg-rose-500/10 inline-flex px-1.5 py-0.5 rounded border border-rose-500/20">
               <TrendingUp size={10} className="mr-1" /> +12% /hr
             </div>
          </div>
        </div>

        {/* Queue Volume Chart */}
        <div>
           <div className="flex justify-between items-end mb-3">
             <h3 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase flex items-center">
               <Activity size={10} className="mr-1.5 text-cyan-500" /> SMQ/RFC Volume
             </h3>
             <span className="text-[9px] font-mono text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">LIVE</span>
           </div>
           <div className="h-24 w-full bg-[#0a0f1c] rounded-lg border border-white/5 p-1 relative cyber-border">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={qData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#02040a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                  itemStyle={{ color: '#22d3ee' }}
                />
                <Area type="monotone" dataKey="qCount" stroke="#06b6d4" strokeWidth={1.5} fillOpacity={1} fill="url(#colorQ)" />
              </AreaChart>
            </ResponsiveContainer>
           </div>
        </div>

        {/* Risk Radar */}
        <div>
          <h3 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-3 flex items-center">
             <Cpu size={10} className="mr-1.5 text-purple-500" /> Subsystem Stress
          </h3>
          <div className="h-40 w-full bg-[#0a0f1c] rounded-lg border border-white/5 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={riskData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
                <Radar name="Risk" dataKey="A" stroke="#a855f7" strokeWidth={1} fill="#a855f7" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health */}
        <div>
          <h3 className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-3 flex items-center justify-between">
             <span>Neural Node Matrix (HANA Core)</span>
             <span className="text-[9px] px-1 bg-[#1e293b] text-slate-400 rounded">v21.0.4</span>
          </h3>
          <div className="space-y-2">
            <HealthItem icon={<Server size={12}/>} name="EWM_QUANTUM_01" status="online" ping="0.02ms" />
            <HealthItem icon={<Database size={12}/>} name="HANA_MEMORY_CLUSTER" status="online" ping="0.04ms" />
            <HealthItem icon={<Zap size={12}/>} name="EVENT_MESH_HUB" status="warning" ping="1.45ms" />
            <HealthItem icon={<ShieldCheck size={12}/>} name="AI_CONSCIOUSNESS_SWARM" status="online" ping="0.01ms" />
          </div>
        </div>

        {/* Quantum Tech Stack / Live Systems */}
        <div className="pt-4 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500">KAFKA EVENT STREAMING</span>
            <span className="text-emerald-400 opacity-80">CONNECTED</span>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500">PINECONE VECTOR DB</span>
            <span className="text-emerald-400 opacity-80">IN SYNCH</span>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500">NEO4J KNOWLEDGE GRAPH</span>
            <span className="text-emerald-400 opacity-80">LIVE</span>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono">
             <span className="text-slate-500">NVIDIA TENSOR INTEL</span>
             <span className="text-cyan-400 opacity-80">145 TFLOPS</span>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono">
             <span className="text-slate-500">XGBOOST PREDICTION</span>
             <span className="text-purple-400 opacity-80">ACTIVE</span>
          </div>
        </div>

      </div>
    </aside>
  );
}

function HealthItem({ icon, name, status, ping }: { icon: React.ReactNode, name: string, status: string, ping: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-white/5 rounded border border-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className={status === 'warning' ? 'text-amber-500' : 'text-slate-400'}>{icon}</div>
        <span className="text-[10px] font-mono text-slate-300">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-slate-500">{ping}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></span>
      </div>
    </div>
  );
}
