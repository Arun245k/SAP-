import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Activity, Network, Zap, ShieldAlert, Cpu, Share2, Layers, AlignEndHorizontal, Gauge, Clock, CloudAlert, RefreshCcw, PackageSearch, Truck, Globe2, CloudUpload, Bot, Send, Sparkles, Trash2, ChevronDown, ChevronUp, Sliders, Eye, EyeOff, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, ComposedChart } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from '../lib/UIContext';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askChartAgent } from '../services/geminiService';

// Lazy load heavy 3D Canvas visualizations to optimize home screen bundle loading under 50ms
const DigitalUniverse = React.lazy(() => import('./DigitalUniverse').then(m => ({ default: m.DigitalUniverse })));
const HolographicEarthWrapper = React.lazy(() => import('./HolographicEarthWrapper').then(m => ({ default: m.HolographicEarthWrapper })));

function ThreeDLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0a0f1c]/40 backdrop-blur-sm relative rounded-xl border border-white/5">
      <div className="w-10 h-10 relative">
        <div className="absolute inset-0 border-2 border-cyan-500/10 rounded-full"></div>
        <div className="absolute inset-0 border-2 border-t-cyan-400 rounded-full animate-spin"></div>
      </div>
      <div className="mt-4 text-[9px] font-mono text-cyan-400/80 tracking-widest uppercase animate-pulse">
        RENDERING_HOLOGRAPHIC_CORES
      </div>
    </div>
  );
}

const colorMap: Record<string, any> = {
  cyan: { bg: 'bg-cyan-500', bg10: 'bg-cyan-500/10', bg5: 'bg-cyan-500/5', border30: 'border-cyan-500/30', border50: 'border-cyan-500/50', border20: 'border-cyan-500/20', text400: 'text-cyan-400', text500: 'text-cyan-500', glow: 'glow-text-cyan', hoverBorder: 'hover:border-cyan-500/30' },
  emerald: { bg: 'bg-emerald-500', bg10: 'bg-emerald-500/10', bg5: 'bg-emerald-500/5', border30: 'border-emerald-500/30', border50: 'border-emerald-500/50', border20: 'border-emerald-500/20', text400: 'text-emerald-400', text500: 'text-emerald-500', glow: 'glow-text-emerald', hoverBorder: 'hover:border-emerald-500/30' },
  amber: { bg: 'bg-amber-500', bg10: 'bg-amber-500/10', bg5: 'bg-amber-500/5', border30: 'border-amber-500/30', border50: 'border-amber-500/50', border20: 'border-amber-500/20', text400: 'text-amber-400', text500: 'text-amber-500', glow: 'glow-text-amber', hoverBorder: 'hover:border-amber-500/30' },
  purple: { bg: 'bg-purple-500', bg10: 'bg-purple-500/10', bg5: 'bg-purple-500/5', border30: 'border-purple-500/30', border50: 'border-purple-500/50', border20: 'border-purple-500/20', text400: 'text-purple-400', text500: 'text-purple-500', glow: 'glow-text-purple', hoverBorder: 'hover:border-purple-500/30' },
  blue: { bg: 'bg-blue-500', bg10: 'bg-blue-500/10', bg5: 'bg-blue-500/5', border30: 'border-blue-500/30', border50: 'border-blue-500/50', border20: 'border-blue-500/20', text400: 'text-blue-400', text500: 'text-blue-500', glow: 'glow-text-blue', hoverBorder: 'hover:border-blue-500/30' },
  rose: { bg: 'bg-rose-500', bg10: 'bg-rose-500/10', bg5: 'bg-rose-500/5', border30: 'border-rose-500/30', border50: 'border-rose-500/50', border20: 'border-rose-500/20', text400: 'text-rose-400', text500: 'text-rose-500', glow: 'glow-text-rose', hoverBorder: 'hover:border-rose-500/30' },
  slate: { bg: 'bg-slate-500', bg10: 'bg-slate-500/10', bg5: 'bg-slate-500/5', border30: 'border-slate-500/30', border50: 'border-slate-500/50', border20: 'border-slate-500/20', text400: 'text-slate-400', text500: 'text-slate-500', glow: 'glow-text-slate', hoverBorder: 'hover:border-slate-500/30' },
  orange: { bg: 'bg-orange-500', bg10: 'bg-orange-500/10', bg5: 'bg-orange-500/5', border30: 'border-orange-500/30', border50: 'border-orange-500/50', border20: 'border-orange-500/20', text400: 'text-orange-400', text500: 'text-orange-500', glow: 'glow-text-orange', hoverBorder: 'hover:border-orange-500/30' }
};

// 3D Visualizations have been code-split into lazy components to optimize bundle load speed.

export function DashboardView({ incidents = [], viewIncidentDetail, onSync, isSyncing }: { 
  incidents?: any[], 
  viewIncidentDetail?: (inc: any) => void,
  onSync?: () => void,
  isSyncing?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'observability' | 'graph' | 'map' | 'history'>('observability');
  const { isAdaptiveEngineEnabled, isSpatialUiEnabled } = useUI();

  // Standard series visibility states
  const [showRfc, setShowRfc] = useState(true);
  const [showTm, setShowTm] = useState(true);
  const [showWt, setShowWt] = useState(true);
  const [showPp, setShowPp] = useState(true);

  // Dynamic Custom SCM Series state
  interface CustomSeries {
    key: string;
    name: string;
    color: string;
    profile: 'sin' | 'cos' | 'linear' | 'random' | 'spike';
    amplitude: number;
    delayOffset: number;
    show: boolean;
  }
  
  const [customSeries, setCustomSeries] = useState<CustomSeries[]>([
    {
      key: 'sdLatency',
      name: 'SD Sales Latency',
      color: '#ec4899', // Pink
      profile: 'cos',
      amplitude: 80,
      delayOffset: 4,
      show: false // Custom registered series start in background or can be activated
    }
  ]);

  const [isAddingSeries, setIsAddingSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesColor, setNewSeriesColor] = useState('#f43f5e'); // Rose 500
  const [newSeriesProfile, setNewSeriesProfile] = useState<'sin' | 'cos' | 'linear' | 'random' | 'spike'>('sin');
  const [newSeriesAmplitude, setNewSeriesAmplitude] = useState(120);

  // AI Agent Chart Bot states
  const [chartQuery, setChartQuery] = useState('');
  const [isChartBotExpanded, setIsChartBotExpanded] = useState(true);
  const [chartAgentHistory, setChartAgentHistory] = useState<Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }>>([
    {
      sender: 'agent',
      text: `### 🤖 SCM CHARTS & REQUIREMENTS AI INTELLIGENCE ACTIVE
Deploying dedicated monitoring agent...
I have loaded full visual telemetry arrays of current SCM throughput and incident distributions.

**I can assist with:**
- 📈 **Metric Analysis**: Run correlation between EWM Warehouse Tasks, TM Freight Orders, and active Incidents.
- ⚙️ **Custom Visualizations**: State your chart requirement and I will provide Recharts blueprints or configuration metrics!
- ⚡ **Operational Prescriptions**: Formulate diagnostic strategies to smooth throughput peaks.`,
      timestamp: new Date()
    }
  ]);
  const [isQueryingChartAgent, setIsQueryingChartAgent] = useState(false);
  const [chartAgentBotError, setChartAgentBotError] = useState<string | null>(null);
  const chartAgentEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (chartAgentEndRef.current) {
      chartAgentEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chartAgentHistory, isQueryingChartAgent]);

  const incidentContext = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = days.map(day => ({ name: day, ewm: 0, tm: 0, pp: 0, sd: 0 }));
    
    incidents.forEach(inc => {
      const d = new Date(inc.timestamp);
      const day = days[d.getDay()];
      const dayData = data.find(item => item.name === day);
      if (dayData) {
        const text = ((inc.title || "") + " " + (inc.analysis || "")).toLowerCase();
        if (text.includes('ewm') || text.includes('warehouse')) dayData.ewm += 1;
        else if (text.includes('tm') || text.includes('freight') || text.includes('route')) dayData.tm += 1;
        else if (text.includes('pp') || text.includes('production') || text.includes('staging')) dayData.pp += 1;
        else if (text.includes('sd') || text.includes('sales')) dayData.sd += 1;
        else dayData.ewm += 1;
      }
    });

    return data;
  }, [incidents]);

  const throughputData = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
        const baseRfc = Math.floor(Math.sin(i / 24 * Math.PI) * 100) + 100;
        const baseTm = Math.floor(Math.cos(i / 24 * Math.PI) * 40) + 40;
        const baseWt = Math.floor(Math.sin(i / 24 * Math.PI) * 200) + 200;
        const basePp = Math.floor(Math.cos(i / 24 * Math.PI) * 25) + 25;
        
        const row: any = {
          time: `${i}:00`,
          rfc: showRfc ? baseRfc + (incidents.length * 2) : 0,
          tmOrder: showTm ? baseTm + Math.floor(incidents.length / 2) : 0,
          wt: showWt ? baseWt + (incidents.length * 5) : 0,
          ppStaging: showPp ? basePp + incidents.length : 0
        };

        // Inject custom registered series based on mathematical layout presets
        customSeries.forEach((series) => {
          if (series.show) {
            let val = 0;
            const x = i + series.delayOffset;
            if (series.profile === 'sin') {
              val = Math.floor(Math.sin(x / 12 * Math.PI) * (series.amplitude / 2)) + (series.amplitude / 2) + 15;
            } else if (series.profile === 'cos') {
              val = Math.floor(Math.cos(x / 12 * Math.PI) * (series.amplitude / 2)) + (series.amplitude / 2) + 15;
            } else if (series.profile === 'linear') {
              val = Math.floor((i / 24) * series.amplitude) + 25;
            } else if (series.profile === 'spike') {
              val = i === 14 ? series.amplitude : (i === 13 || i === 15 ? Math.floor(series.amplitude / 3) : 12);
            } else {
              val = Math.floor(Math.sin(x / 6 * Math.PI) * 15) + Math.floor(series.amplitude / 2);
            }
            row[series.key] = val;
          }
        });

        return row;
    });
  }, [incidents, showRfc, showTm, showWt, showPp, customSeries]);

  const handleQueryChartAgent = async (customPrompt?: string) => {
    const queryToSend = customPrompt || chartQuery;
    if (!queryToSend.trim() || isQueryingChartAgent) return;

    setChartQuery('');
    setChartAgentBotError(null);
    setIsQueryingChartAgent(true);

    // Add user message to history
    setChartAgentHistory(prev => [...prev, {
      sender: 'user',
      text: queryToSend,
      timestamp: new Date()
    }]);

    try {
      const chartSnapshot = {
        activeKPIs: {
          totalIncidents: incidents.length,
          ewmIssues: incidentContext.reduce((acc, curr) => acc + curr.ewm, 0),
          tmAnomalies: incidentContext.reduce((acc, curr) => acc + curr.tm, 0),
          resolutionRate: incidents.length > 0 ? "100%" : "0%"
        },
        weeklyAnomalyDistribution: incidentContext,
        hourlyKinematicThroughput: throughputData
      };

      const result = await askChartAgent(queryToSend, chartSnapshot);
      
      setChartAgentHistory(prev => [...prev, {
        sender: 'agent',
        text: result,
        timestamp: new Date()
      }]);
    } catch (err: any) {
      setChartAgentBotError(err.message || "Failed to establish secure routing link with agent swarm.");
    } finally {
      setIsQueryingChartAgent(false);
    }
  };

  // Adaptive Grid class determination based on context
  const dynamicGridClasses = isAdaptiveEngineEnabled 
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
    : "grid grid-cols-1 md:grid-cols-4 gap-4";
    
  const chartGridClasses = isAdaptiveEngineEnabled
    ? "grid grid-cols-1 xl:grid-cols-3 gap-6"
    : "grid grid-cols-1 lg:grid-cols-3 gap-6";

  const spatialClasses = isSpatialUiEnabled ? "glass-card shadow-2xl hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] transform-gpu hover:-translate-y-1" : "bg-[#0f172a]/60";

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#02040a]">
       <div className="absolute top-0 right-0 w-[50vh] h-[50vh] radial-bg pointer-events-none opacity-50 z-0"></div>
       <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none z-0"></div>
       {isSpatialUiEnabled && <div className="scanline"></div>}

       <header className={`min-h-[4rem] flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 md:px-8 py-4 gap-4 border-b border-white/5 shrink-0 z-10 relative ${isSpatialUiEnabled ? 'glass-panel' : 'bg-[#02040a]/80'}`}>
        <div className="flex items-center space-x-4">
          <h1 className="text-xs font-display font-semibold text-slate-200 flex items-center tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-3 animate-pulse glow-text-purple shrink-0"></span>
            QUANTUM_CONTROL_TOWER <span className="text-purple-500/50 ml-2 font-mono text-[10px] hidden sm:inline">GLOBAL_OMNI_VIEW</span>
          </h1>
        </div>
        <div className={`flex items-center max-w-full overflow-x-auto scrollbar-none backdrop-blur-md rounded-lg p-1 border shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isSpatialUiEnabled ? 'bg-[#0f172a]/80 border-white/10' : 'bg-[#0f172a] border-white/5'}`}>
          <button 
            onClick={() => setActiveTab('observability')}
            className={`whitespace-nowrap px-3 md:px-4 py-1.5 rounded-md text-[10px] font-mono tracking-widest transition-all duration-300 ${activeTab === 'observability' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
          >
            NEURAL_TELEMETRY
          </button>
          <button 
            onClick={() => setActiveTab('graph')}
            className={`whitespace-nowrap px-3 md:px-4 py-1.5 rounded-md text-[10px] font-mono tracking-widest transition-all duration-300 ${activeTab === 'graph' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
          >
            QUANTUM_DIGITAL_TWIN
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`whitespace-nowrap px-3 md:px-4 py-1.5 rounded-md text-[10px] font-mono tracking-widest transition-all duration-300 ${activeTab === 'map' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
          >
            SPATIAL_OPERATIONAL_MAP
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`whitespace-nowrap px-3 md:px-4 py-1.5 rounded-md text-[10px] font-mono tracking-widest transition-all duration-300 ${activeTab === 'history' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
          >
            PREVIOUS_HISTORY
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-5xl mx-auto space-y-4"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                  <h2 className="text-lg font-display font-semibold text-slate-100 tracking-widest uppercase flex items-center">
                    <Clock size={20} className="mr-3 text-purple-400" />
                    Temporal DNA Log
                  </h2>
                  <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">Accessing indexed operational recovery fragments</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-[10px] tracking-widest transition-all duration-300 ${
                      isSyncing 
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 cursor-wait' 
                        : 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    }`}
                  >
                    {isSyncing ? (
                      <RefreshCcw size={14} className="animate-spin" />
                    ) : (
                      <RefreshCcw size={14} />
                    )}
                    {isSyncing ? 'REFRESHING...' : 'REFRESH VAULT DATA'}
                  </button>
                  <div className="text-[10px] font-mono text-purple-400 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded uppercase tracking-widest">
                    Total Records: {incidents.length}
                  </div>
                </div>
              </div>

              {incidents.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                  <div className="lg:col-span-2 glass-card p-4 rounded-xl border border-white/5 bg-[#0f172a]/40 h-48 overflow-hidden group">
                    <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                      <Activity size={14} className="mr-2 text-purple-400" /> Temporal DNA Distribution
                    </h3>
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={incidents.slice(0, 10).map((inc, i) => ({ name: `T-${i}`, val: inc.title.length }))}>
                          <Bar dataKey="val" fill="#a855f7" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-card p-4 rounded-xl border border-white/5 bg-[#0f172a]/40 h-48 flex flex-col items-center justify-center text-center group translate-z-0">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
                       <ShieldAlert size={20} className="text-purple-400" />
                    </div>
                    <div className="text-2xl font-display text-white mb-1">{incidents.length}</div>
                    <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Active Memory Synapses</div>
                  </div>
                </div>
              )}

              {incidents.length > 0 ? (
                <div className="grid gap-3">
                  {incidents.slice(0, 10).map((inc: any) => (
                    <div 
                      key={inc.id}
                      onClick={() => viewIncidentDetail?.(inc)}
                      className={`p-4 rounded-xl border border-white/5 bg-[#0f172a]/40 hover:bg-[#0f172a]/60 hover:border-purple-500/30 transition-all cursor-pointer group relative overflow-hidden ${isSpatialUiEnabled ? 'glass-card' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-4 relaltive z-10">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="text-[9px] font-mono text-purple-500/70 uppercase tracking-[0.2em]">{new Date(inc.timestamp).toLocaleString()}</div>
                          <h4 className="text-sm font-display font-bold text-slate-200 tracking-wider group-hover:text-purple-300 transition-colors truncate">{inc.title}</h4>
                          <p className="text-[11px] text-slate-500 font-mono line-clamp-2 mt-1">{inc.problem}</p>
                        </div>
                        <div className="w-8 h-8 rounded border border-white/10 bg-white/5 flex items-center justify-center shrink-0 group-hover:border-purple-500/50 group-hover:animate-pulse">
                          <AlignEndHorizontal size={14} className="text-slate-500 group-hover:text-purple-400" />
                        </div>
                      </div>
                      {isSpatialUiEnabled && <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-500/5 rounded-full filter blur-2xl group-hover:bg-purple-500/10 transition-all"></div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-[#0f172a]/20">
                  <PackageSearch size={48} className="text-slate-700 mb-4" />
                  <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">No previous history detected in local matrix</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'observability' && (
            <motion.div 
              key="obs" 
              layout={isAdaptiveEngineEnabled}
              initial="hidden" 
              animate="visible" 
              exit="exit" 
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: isAdaptiveEngineEnabled ? 0.05 : 0 }
                },
                exit: { opacity: 0, transition: { duration: 0.2 } }
              }}
              className={`w-full max-w-full 2xl:max-w-[1920px] mx-auto space-y-6 transition-all duration-500`}
            >
              
              {/* KPIs */}
              <motion.div layout={isAdaptiveEngineEnabled} className={dynamicGridClasses}>
                <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }}>
                  <KPICard title="TOTAL INCIDENTS" value={incidents.length} trend="+1" icon={<Cpu className="text-cyan-400" size={18}/>} color="cyan"/>
                </motion.div>
                <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }}>
                  <KPICard title="EWM ISSUES" value={incidentContext.reduce((acc, curr) => acc + curr.ewm, 0)} trend="-0.8" icon={<Clock className="text-emerald-400" size={18}/>} color="emerald"/>
                </motion.div>
                <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }}>
                  <KPICard title="TM ANOMALIES" value={incidentContext.reduce((acc, curr) => acc + curr.tm, 0)} trend="-3" icon={<ShieldAlert className="text-amber-400" size={18}/>} color="amber"/>
                </motion.div>
                <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }}>
                  <KPICard title="RESOLUTION RATE" value={incidents.length > 0 ? "100%" : "0%"} trend="+0.1%" icon={<Network className="text-purple-400" size={18}/>} color="purple"/>
                </motion.div>
              </motion.div>

              {/* Charts Row */}
              <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }} className={chartGridClasses}>
                
                {/* Throughput Chart */}
                <motion.div layout={isAdaptiveEngineEnabled} className={`xl:col-span-2 rounded-xl border border-white/5 cyber-border p-6 relative overflow-hidden hover:border-cyan-500/30 transition-all duration-500 group ${spatialClasses}`}>
                  {isSpatialUiEnabled && <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-bl-full filter blur-[40px] pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-500"></div>}
                  
                  {/* Dynamic Custom Chart Controller Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                      <Activity size={14} className="text-cyan-400 animate-pulse" />
                      <div>
                        <h3 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase">
                          Global Kinematic Throughput (RFC/TM/WT)
                        </h3>
                        <p className="text-[8px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">
                          ACTIVE_CHART_POLARITY // LAYERED RECHARTS CONSOLE
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsAddingSeries(!isAddingSeries)}
                        className={`px-2 py-1 rounded text-[9px] font-mono border transition-all flex items-center gap-1 cursor-pointer ${
                          isAddingSeries 
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30'
                        }`}
                        title="Add custom simulated metric line to this chart"
                      >
                        <Plus size={11} /> {isAddingSeries ? "CLOSE_PROMPT" : "REGISTER_CUSTOM_KPI"}
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Custom Metric Form */}
                  <AnimatePresence>
                    {isAddingSeries && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-950/60 border border-white/10 rounded-lg p-4 mb-4 text-xs font-mono"
                      >
                        <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Sliders size={12} className="text-rose-400" /> Plot Dynamic Custom KPI Requirements
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Metric Title</label>
                            <input
                              type="text"
                              value={newSeriesName}
                              onChange={(e) => setNewSeriesName(e.target.value)}
                              placeholder="e.g., Sales Latency"
                              className="w-full bg-black/60 border border-white/10 focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/30 rounded px-2 py-1 text-slate-200 outline-none text-[10px]"
                            />
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Curve Preset</label>
                            <select
                              value={newSeriesProfile}
                              onChange={(e: any) => setNewSeriesProfile(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 focus:border-rose-500/40 rounded px-2.5 py-1 text-slate-200 outline-none text-[10px]"
                            >
                              <option value="sin">Sine Wave Modulation</option>
                              <option value="cos">Cosine Valley Shift</option>
                              <option value="linear">Uptrend Velocity</option>
                              <option value="spike">Handover Peak Spike</option>
                              <option value="random">Operational Noise</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Accent Color</label>
                            <select
                              value={newSeriesColor}
                              onChange={(e) => setNewSeriesColor(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 focus:border-rose-500/40 rounded px-2 py-1 text-slate-200 outline-none text-[10px]"
                            >
                              <option value="#f43f5e" style={{ color: '#f43f5e' }}>Rose Neon</option>
                              <option value="#fb923c" style={{ color: '#fb923c' }}>Orange Amber</option>
                              <option value="#34d399" style={{ color: '#34d399' }}>Emerald Green</option>
                              <option value="#38bdf8" style={{ color: '#38bdf8' }}>Sky Blue</option>
                              <option value="#a855f7" style={{ color: '#a855f7' }}>Indigo Purple</option>
                              <option value="#ec4899" style={{ color: '#ec4899' }}>Pink Rose</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Scale / Amplitude</label>
                            <input
                              type="number"
                              min="10"
                              max="400"
                              value={newSeriesAmplitude}
                              onChange={(e) => setNewSeriesAmplitude(Number(e.target.value))}
                              className="w-full bg-black/60 border border-white/10 focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/30 rounded px-2 py-1 text-slate-200 outline-none text-[10px]"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingSeries(false);
                            }}
                            className="px-2.5 py-1 rounded hover:bg-white/5 border border-transparent text-[9px] text-slate-400 transition-colors uppercase cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newSeriesName.trim()) return;
                              const key = 'custom_' + Date.now().toString(36);
                              const item: CustomSeries = {
                                key,
                                name: newSeriesName,
                                color: newSeriesColor,
                                profile: newSeriesProfile,
                                amplitude: newSeriesAmplitude,
                                delayOffset: Math.floor(Math.random() * 8),
                                show: true
                              };
                              setCustomSeries(prev => [...prev, item]);
                              setIsAddingSeries(false);
                              setNewSeriesName('');
                            }}
                            className="px-3 py-1 rounded bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-300 text-[9px] transition-all uppercase font-bold tracking-widest cursor-pointer"
                          >
                            PLOT ON CHART
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* High tech interactive legend / toggles */}
                  <div className="flex flex-wrap items-center gap-3 mb-5 text-[10px] font-mono">
                    <span className="text-slate-500 uppercase text-[9px] tracking-wider">Viewport Filters:</span>
                    
                    <button
                      type="button"
                      onClick={() => setShowRfc(!showRfc)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        showRfc 
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-bold' 
                          : 'bg-transparent border-white/5 text-slate-600 line-through'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      Integration RFCs
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTm(!showTm)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        showTm 
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-bold' 
                          : 'bg-transparent border-white/5 text-slate-600 line-through'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      TM Freight Orders
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWt(!showWt)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        showWt 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' 
                          : 'bg-transparent border-white/5 text-slate-600 line-through'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      EWM Warehouse Tasks
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPp(!showPp)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        showPp 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' 
                          : 'bg-transparent border-white/5 text-slate-600 line-through'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      PP Production Supply
                    </button>

                    {/* Custom series dynamic tags */}
                    {customSeries.map((series, idx) => (
                      <div key={series.key} className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10 hover:border-white/20 transition-all">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...customSeries];
                            updated[idx].show = !updated[idx].show;
                            setCustomSeries(updated);
                          }}
                          className={`flex items-center gap-1.5 text-[10px] transition-all font-mono cursor-pointer ${
                            series.show ? 'text-slate-200' : 'text-slate-600 line-through'
                          }`}
                          style={{ color: series.show ? series.color : undefined }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: series.color }}></span>
                          {series.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = customSeries.filter(s => s.key !== series.key);
                            setCustomSeries(updated);
                          }}
                          className="ml-1.5 text-[8px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove custom series"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <ComposedChart data={throughputData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRfc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#334155" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                        <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#02040a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)' }} />
                        
                        {showRfc && <Area type="monotone" dataKey="rfc" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRfc)" strokeWidth={2} name="Integration RFCs" />}
                        {showTm && <Area type="monotone" dataKey="tmOrder" stroke="#a855f7" fillOpacity={1} fill="url(#colorTm)" strokeWidth={2} name="TM Freight Orders" />}
                        {showWt && <Line type="monotone" dataKey="wt" stroke="#10b981" strokeWidth={2} dot={false} name="EWM Warehouse Tasks" />}
                        {showPp && <Line type="step" dataKey="ppStaging" stroke="#f59e0b" strokeWidth={2} dot={false} name="PP Production Supply" />}
                        
                        {/* Dynamic Custom Registered Series Lines */}
                        {customSeries.map((series) => {
                          if (series.show) {
                            return (
                              <Line 
                                key={series.key}
                                type="monotone" 
                                dataKey={series.key} 
                                stroke={series.color} 
                                strokeWidth={2} 
                                dot={false}
                                name={series.name} 
                              />
                            );
                          }
                          return null;
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Incident Stack */}
                <motion.div layout={isAdaptiveEngineEnabled} className={`rounded-xl border border-white/5 cyber-border p-6 relative overflow-hidden hover:border-rose-500/30 transition-all duration-500 group ${spatialClasses}`}>
                   {isSpatialUiEnabled && <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-bl-full filter blur-[40px] pointer-events-none group-hover:bg-rose-500/10 transition-all duration-500"></div>}
                  <h3 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase mb-6 flex items-center">
                    <CloudAlert size={14} className="mr-2 text-rose-400 animate-pulse" />
                    Autonomous Anomaly Vectors
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={incidentContext} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#334155" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                        <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#02040a', border: '1px solid #1e293b', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)' }} cursor={{fill: '#0f172a'}} />
                        <Bar dataKey="ewm" stackId="a" fill="#06b6d4" name="EWM Incidents" />
                        <Bar dataKey="tm" stackId="a" fill="#a855f7" name="TM Incidents" />
                        <Bar dataKey="pp" stackId="a" fill="#f59e0b" name="PP Incidents" />
                        <Bar dataKey="sd" stackId="a" fill="#3b82f6" name="SD Incidents" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </motion.div>
              
              {/* SCM Chart intelligence Bot & Requirements Engine */}
              <motion.div 
                layout={isAdaptiveEngineEnabled}
                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} 
                style={{ willChange: "transform, opacity" }}
                className={`rounded-xl border border-white/5 cyber-border overflow-hidden transition-all duration-500 relative flex flex-col ${spatialClasses}`}
              >
                {isSpatialUiEnabled && (
                  <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-bl-full filter blur-[60px] pointer-events-none"></div>
                )}
                
                {/* Header with high-tech status and toggle */}
                <div 
                  className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40 cursor-pointer select-none"
                  onClick={() => setIsChartBotExpanded(!isChartBotExpanded)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-lg bg-cyan-400/20 animate-ping opacity-45"></div>
                      <Bot size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-display font-bold text-slate-200 tracking-widest uppercase flex items-center gap-2">
                        SCM CHART INTELLIGENCE BOT 
                        <span className="text-[9px] font-mono font-normal text-cyan-400 bg-cyan-400/10 border border-cyan-400/25 px-1.5 py-0.5 rounded tracking-wide uppercase">
                          REQUIREMENTS_CORE
                        </span>
                      </h3>
                      <div className="text-[8px] font-mono text-slate-500 tracking-wider flex items-center gap-1.5 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                        PLANETARY METRIC STREAM ACTIVE // RECHARTS ENGINE INITIALIZED
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setChartAgentHistory([
                          {
                            sender: 'agent',
                            text: `### 🤖 REGISTER LOGS RETRIEVED\nCognitive buffer reset successfully. Standing by for SCM metrics & chart queries.`,
                            timestamp: new Date()
                          }
                        ]);
                      }}
                      className="p-1 px-2.5 rounded text-[9px] font-mono text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all flex items-center gap-1.5"
                      title="Clear history"
                    >
                      <Trash2 size={11} /> CLEAN_BUFFER
                    </button>
                    <button 
                      type="button" 
                      className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                    >
                      {isChartBotExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isChartBotExpanded && (
                  <div className="p-6 space-y-6 flex flex-col bg-black/20">
                    {/* Chat log window */}
                    <div className="h-72 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-850 scrollbar-track-transparent border border-white/5 bg-[#02040a]/80 rounded-lg p-4 font-mono text-xs">
                      {chartAgentHistory.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex flex-col max-w-[90%] ${
                            msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                          }`}
                        >
                          <div className={`text-[9px] text-slate-500 mb-1 flex items-center gap-1`}>
                            {msg.sender === 'user' ? 'COMMANDER_INPUT' : 'COGNITIVE_CORE'} // {msg.timestamp.toLocaleTimeString()}
                          </div>
                          
                          <div 
                            className={`p-3.5 rounded-lg border text-[11px] leading-relaxed w-full whitespace-pre-wrap ${
                              msg.sender === 'user' 
                                ? 'bg-[#0f172a] text-cyan-200 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)]' 
                                : 'bg-[#0a0f1c]/50 text-slate-300 border-white/5'
                            }`}
                          >
                            {msg.sender === 'user' ? (
                              <div>{msg.text}</div>
                            ) : (
                              <div className="prose prose-invert prose-xs max-w-none w-full text-slate-300 markdown-body">
                                <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {isQueryingChartAgent && (
                        <div className="flex flex-col mr-auto items-start max-w-[80%]">
                          <div className="text-[9px] text-slate-500 mb-1">COGNITIVE_CORE // MATRIX_QUERYING...</div>
                          <div className="p-3.5 rounded-lg border border-cyan-500/20 bg-cyan-950/10 text-cyan-300 flex items-center space-x-3">
                            <span className="animate-spin text-cyan-400">🔄</span>
                            <span className="text-[10px] uppercase tracking-widest font-mono animate-pulse">Running quantum analytical cross-correlation...</span>
                          </div>
                        </div>
                      )}

                      {chartAgentBotError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg text-[10px] uppercase font-mono tracking-wider">
                          ⚠️ EXCEPTION DETECTED: {chartAgentBotError}
                        </div>
                      )}
                      
                      <div ref={chartAgentEndRef} />
                    </div>

                    {/* Preconfigured requirement prompts */}
                    <div>
                      <div className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center">
                        <Sparkles size={11} className="mr-1.5 text-cyan-400" /> Instant SCM Analysis & Custom Chart Specifications
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => handleQueryChartAgent("Analyze the peaks in the Global Kinematic Throughput and explain how EWM Warehouse Tasks relate to active RFC blockages.")}
                          className="text-left p-2.5 rounded-lg bg-white/5 hover:bg-cyan-500/5 text-[10px] font-mono text-slate-300 border border-white/5 hover:border-cyan-500/30 transition-all flex items-start gap-2.5 group"
                        >
                          <span className="text-cyan-400 font-bold group-hover:scale-110 transition-transform">📊</span>
                          <div>
                            <div className="font-bold text-slate-200">Cross-Correlate WT vs RFC Queue Peaks</div>
                            <span className="text-[9px] text-slate-500 text-slate-400 mt-0.5 block">Examine correlation peaks & queue delays</span>
                          </div>
                        </button>
                        
                        <div className="relative group/btn w-full">
                          <button 
                            type="button"
                            onClick={() => handleQueryChartAgent("The business team requires a new chart tracking Sales Order (SD) vs TM Freight Order creation latency. Draft a custom React and Recharts configuration to map this.")}
                            className="w-full text-left p-2.5 pr-20 rounded-lg bg-white/5 hover:bg-purple-500/5 text-[10px] font-mono text-slate-300 border border-white/5 hover:border-purple-500/30 transition-all flex items-start gap-2.5 group/inner"
                          >
                            <span className="text-purple-400 font-bold group-hover/inner:scale-110 transition-transform">⚙️</span>
                            <div>
                              <div className="font-bold text-slate-200">Build SD-TM Latency Chart Component</div>
                              <span className="text-[9px] text-slate-500 text-slate-400 mt-0.5 block">Get React visual config and custom code</span>
                            </div>
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = customSeries.map(s => s.key === 'sdLatency' ? { ...s, show: true } : s);
                              setCustomSeries(updated);
                              setIsChartBotExpanded(true);
                              
                              setChartAgentHistory(prev => [...prev, {
                                sender: 'agent',
                                text: `⚡ **NEXUS KINEMATIC VIEWPORT UPDATE SUCCESSFUL**\n\nI have successfully injected the custom **Sales Order (SD) vs TM Freight creation latency** line directly into the live viewport matrix above.\n\n- **Series Key**: \`sdLatency\`\n- **Preset algorithm**: Cosine valley modulation curve\n- **Action completed**: Live plot rendered on the viewport.\n\nYou can toggle its visibility or delete/re-register metrics anytime using the **REGISTER_CUSTOM_KPI** dashboard!`,
                                timestamp: new Date()
                              }]);
                            }}
                            className="absolute right-2 top-2.5 bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/30 hover:border-purple-500 hover:text-purple-200 text-purple-400 text-[8px] font-mono py-1 px-2.5 rounded tracking-wide uppercase transition-all cursor-pointer z-10"
                            title="Plot this requirement directly on the existing throughput chart!"
                          >
                            PLOT LIVE
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => handleQueryChartAgent("Provide operational diagnostics based on open EWM Warehouse Tasks. How do we smooth the throughput valleys shown in the charts?")}
                          className="text-left p-2.5 rounded-lg bg-white/5 hover:bg-emerald-500/5 text-[10px] font-mono text-slate-300 border border-white/5 hover:border-emerald-500/30 transition-all flex items-start gap-2.5 group"
                        >
                          <span className="text-emerald-400 font-bold group-hover:scale-110 transition-transform">🧠</span>
                          <div>
                            <div className="font-bold text-slate-200">Generate Throughput Optimization Plan</div>
                            <span className="text-[9px] text-slate-500 text-slate-400 mt-0.5 block">Detailed SCM pipeline clearing recipes</span>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleQueryChartAgent("We want to add a KPI card tracking ATP check errors in PP. What tables and modules are required to build this visualization?")}
                          className="text-left p-2.5 rounded-lg bg-white/5 hover:bg-amber-500/5 text-[10px] font-mono text-slate-300 border border-white/5 hover:border-amber-500/30 transition-all flex items-start gap-2.5 group"
                        >
                          <span className="text-amber-400 font-bold group-hover:scale-110 transition-transform">🗄️</span>
                          <div>
                            <div className="font-bold text-slate-200">Map ATP Error Telemetry Master Data</div>
                            <span className="text-[9px] text-slate-500 text-slate-400 mt-0.5 block">SAP Backend tables and KPI properties</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Chat text area */}
                    <div className="flex gap-2">
                      <textarea
                        value={chartQuery}
                        onChange={(e) => setChartQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleQueryChartAgent();
                          }
                        }}
                        placeholder="State your visualization requirements, ask questions on active chart data, or draft custom layout configurations..."
                        className="flex-1 bg-black/60 border border-white/10 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 rounded-lg p-3 text-cyan-100 placeholder:text-slate-650 font-mono text-xs outline-none resize-none h-14"
                      />
                      <button
                        type="button"
                        onClick={() => handleQueryChartAgent()}
                        disabled={!chartQuery.trim() || isQueryingChartAgent}
                        className="px-4 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 disabled:opacity-30 disabled:border-transparent disabled:bg-transparent rounded-lg transition-all flex flex-col items-center justify-center min-w-[70px]"
                      >
                        {isQueryingChartAgent ? (
                          <span className="animate-spin text-cyan-400">🔄</span>
                        ) : (
                          <>
                            <Send size={15} />
                            <span className="text-[8px] font-mono uppercase tracking-widest mt-1">SEND_REQ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Rapid Analysis Upload Area */}
              <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }} className={`rounded-xl border border-dashed border-cyan-500/30 p-8 flex flex-col items-center justify-center text-center bg-[#06b6d4]/5 hover:bg-[#06b6d4]/10 transition-all cursor-pointer group`}
                onClick={() => {
                  const chatBtn = document.querySelector('button[onClick*="chat"]') as HTMLElement;
                  if (chatBtn) chatBtn.click();
                  setTimeout(() => {
                    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
                    if (fileInput) fileInput.click();
                  }, 100);
                }}
              >
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-500/20">
                  <CloudUpload className="text-cyan-400" size={32} />
                </div>
                <h3 className="text-sm font-display font-bold text-cyan-300 tracking-[0.2em] uppercase mb-2">Initialize Visual Anomaly Analysis</h3>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest max-w-sm">Drop error screenshots, log fragments, or operational telemetry for instant Quantum Reasoning extraction.</p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-mono border border-cyan-500/30 tracking-widest uppercase">Select Attachments</span>
                </div>
              </motion.div>

              {/* AI Agent Status Matrix */}
              <motion.div layout={isAdaptiveEngineEnabled} variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } }} style={{ willChange: "transform, opacity" }} className={`rounded-xl border border-white/5 cyber-border p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 ${spatialClasses}`}>
                 {isSpatialUiEnabled && <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-tr-full filter blur-[60px] pointer-events-none group-hover:bg-purple-500/10 transition-all duration-1000"></div>}
                 <h3 className="text-[11px] font-mono tracking-widest text-slate-300 uppercase mb-6 flex items-center relative z-10">
                    <Layers size={14} className="mr-2 text-purple-400 animate-pulse" />
                    Quantum Agent Civilization Swarm Status
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                    <AgentStatus name="EWM Hive Mind" status="ACTIVE" load="42%" ops="1.2M/s" color="cyan" />
                    <AgentStatus name="TM Routing Cortex" status="ACTIVE" load="68%" ops="450K/s" color="purple" />
                    <AgentStatus name="PP Production Node" status="ACTIVE" load="84%" ops="4.5M/s" color="amber" />
                    <AgentStatus name="ERP Core Integration" status="ACTIVE" load="32%" ops="890K/s" color="blue" />
                 </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'graph' && (
            <motion.div key="graph" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} style={{ willChange: "transform, opacity" }} className="w-full h-[60vh] md:h-[calc(100vh-12rem)] min-h-[400px] flex items-center justify-center relative mt-4 md:mt-0">
               <div className="absolute inset-0 bg-[#0a0f1c] rounded-2xl border border-white/5 cyber-border flex items-center justify-center overflow-hidden">

                  
                  <div className="absolute inset-0 w-full h-full">
                    <React.Suspense fallback={<ThreeDLoader />}>
                      <DigitalUniverse />
                    </React.Suspense>
                  </div>

                  <div className={`absolute top-6 left-6 p-4 rounded-xl border border-white/5 z-10 w-96 backdrop-blur-2xl bg-[#02040a]/80 shadow-[0_0_25px_rgba(0,0,0,0.8)] cyber-border ${spatialClasses}`}>
                    {isSpatialUiEnabled && <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-full filter blur-[20px] pointer-events-none"></div>}
                    <h4 className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-3 flex items-center relative z-10">
                      <Network size={12} className="mr-2" /> Spatial-Temporal Topology Inference
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono leading-relaxed mb-4 relative z-10 border-l-2 border-cyan-500/50 pl-3">
                      Neural net mapping multi-dimensional SCM kinematic dependencies: Procure-to-Pay (MM&rarr;EWM), Order-to-Cash (SD&rarr;TM), and Make-to-Stock (PP&rarr;EWM) across the global cluster.
                    </p>
                    <div className="flex items-center justify-between mt-2 relative z-10">
                      <div className="flex items-center text-[9px] text-amber-400 font-mono tracking-widest uppercase">
                        <RefreshCcw size={10} className="mr-1.5 animate-spin"/> QUANTUM RECOMPILING
                      </div>
                      <div className="text-[9px] font-mono text-emerald-400">99.998% SYNCHRONIZED</div>
                    </div>
                  </div>

               </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} style={{ willChange: "transform, opacity" }} className="w-full h-[60vh] md:h-[calc(100vh-12rem)] min-h-[400px] flex items-center justify-center relative mt-4 md:mt-0">
               <div className="w-full h-full bg-[#0a0f1c] rounded-2xl border border-white/5 cyber-border flex items-center justify-center overflow-hidden relative">
                  
                  <div className="absolute inset-0 w-full h-full">
                    <React.Suspense fallback={<ThreeDLoader />}>
                      <HolographicEarthWrapper />
                    </React.Suspense>
                  </div>

                  <div className={`absolute top-6 left-6 p-6 rounded-xl border border-white/5 z-10 w-96 backdrop-blur-3xl bg-[#02040a]/90 cyber-border group hover:border-indigo-500/30 transition-all duration-500 ${spatialClasses}`}>
                    {isSpatialUiEnabled && <div className="absolute inset-0 bg-indigo-500/5 filter blur-[30px] rounded-xl pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-500"></div>}
                    <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-4 flex items-center relative z-10">
                      <Globe2 size={12} className="mr-2" /> Global Holographic Projection
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono leading-relaxed mb-5 relative z-10 border-l-2 border-indigo-500/50 pl-3">
                      Real-time planetary view representing warehouse kinematics, integration queue integrity, and sub-orbital transportation routes.
                    </p>
                    <div className="space-y-3 mt-4 border-t border-white/10 pt-5 relative z-10">
                      <div className="flex flex-col gap-1 text-[9px] font-mono">
                        <div className="flex justify-between items-center text-slate-400">
                           <span>EU-CENTRAL CONSTRUCT (CRITICAL)</span>
                           <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        </div>
                        <span className="text-rose-400 font-bold glow-text-rose">98% QUEUE BACKLOG MATRIX DETECTED</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[9px] font-mono mt-2">
                         <div className="flex justify-between items-center text-slate-400">
                           <span>APJ-CORE MODULE (WARNING)</span>
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        </div>
                        <span className="text-amber-400 font-bold">ATP ALGORITHM ASYNC</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[9px] font-mono mt-2">
                         <div className="flex justify-between items-center text-slate-400">
                           <span>US-EAST NODE (NOMINAL)</span>
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        </div>
                        <span className="text-emerald-400 font-bold glow-text-emerald">QUANTUM ROUTING SUCCESS</span>
                      </div>
                    </div>
                  </div>

               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
function KPICard({ title, value, trend, icon, color }: any) {
  const isUp = trend?.startsWith('+');
  const c = colorMap[color] || colorMap['slate'];
  return (
    <div className={`glass-card p-5 rounded-xl border border-white/5 relative overflow-hidden group ${c.hoverBorder} transition-colors`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${c.bg5} rounded-bl-full filter blur-[20px]`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="text-[10px] font-mono tracking-widest uppercase text-slate-500">{title}</div>
        <div className={`p-1.5 rounded-lg border ${c.border20} ${c.bg10}`}>{icon}</div>
      </div>
      <div className="flex items-end gap-3 relative z-10">
        <div className={`text-3xl font-display text-slate-200 ${c.glow}`}>{value}</div>
        <div className={`text-[11px] font-mono mb-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{trend}</div>
      </div>
    </div>
  );
}

function AgentStatus({ name, status, load, ops, color }: any) {
  const isActive = status === 'ACTIVE';
  const c = colorMap[color] || colorMap['slate'];
  const inactive = colorMap['slate'];
  return (
    <div className="bg-[#0a0f1c] border border-white/5 rounded-lg p-4 flex flex-col justify-between hover:bg-white/5 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{name}</span>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border tracking-widest ${isActive ? `${c.bg10} ${c.text400} ${c.border30}` : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
          {status}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>Swarm Load</span>
          <span className="text-slate-300">{load}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1">
          <div className={`${isActive ? c.bg : inactive.bg} h-1 rounded-full`} style={{ width: load }}></div>
        </div>
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest text-right mt-1">
          OPS: <span className="text-slate-400">{ops}</span>
        </div>
      </div>
    </div>
  )
}

function GraphNode({ id, label, sub, x, y, color, pulse }: any) {
  const c = colorMap[color.replace('bg-', '').replace('-500', '')] || colorMap['slate'];
  return (
    <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: x, top: y }}>
      <div className={`w-12 h-12 rounded-2xl ${c.bg10} border ${c.border50} flex items-center justify-center relative mb-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md`}>
         {pulse && <div className={`absolute inset-0 rounded-2xl ${c.bg} opacity-20 animate-ping`}></div>}
         <Network size={20} className={`${c.text400}`} />
      </div>
      <div className="text-center">
        <div className={`text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest ${c.glow}`}>{label}</div>
        <div className="text-[9px] font-mono text-slate-500 uppercase">{sub}</div>
      </div>
    </div>
  )
}

function MapNode({ city, region, nodeType, status, x, y }: any) {
  const getStatusColor = () => {
    if (status === 'critical') return 'rose';
    if (status === 'warning') return 'amber';
    return 'emerald';
  };
  const colorStr = getStatusColor();
  const c = colorMap[colorStr];
  
  return (
    <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10" style={{ left: x, top: y }}>
      <div className={`w-4 h-4 rounded-full ${c.bg} ${c.glow} relative mb-2 flex items-center justify-center`}>
         <div className={`absolute inset-0 rounded-full ${c.bg} animate-ping opacity-60`}></div>
      </div>
      <div className="bg-[#02040a]/90 border border-white/10 px-3 py-2 rounded shadow-2xl backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity">
        <div className="text-[11px] font-display font-bold text-slate-200 uppercase tracking-widest">{city}</div>
        <div className={`text-[9px] font-mono uppercase tracking-widest ${c.text400} mt-0.5`}>{nodeType}</div>
        <div className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">{region}</div>
      </div>
    </div>
  )
}

export default DashboardView;
