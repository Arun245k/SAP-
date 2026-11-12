import React from 'react';
import { Palette, Key, Shield, Settings2, Monitor, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUI } from '../lib/UIContext';
import { useAuth } from './AuthProvider';

interface SettingsViewProps {
  theme: string;
  setTheme: (theme: string) => void;
}

export function SettingsView({ theme, setTheme }: SettingsViewProps) {
  const { 
    isAutonomousEnabled, setIsAutonomousEnabled,
    isPredictiveEnabled, setIsPredictiveEnabled,
    isAdaptiveEngineEnabled, setIsAdaptiveEngineEnabled,
    isSpatialUiEnabled, setIsSpatialUiEnabled
  } = useUI();
  const [isOssNoteEnabled, setIsOssNoteEnabled] = React.useState(false);
  const { user, logOut } = useAuth();

  const themes = [
    { id: 'nexus', name: 'NEXUS DEFAULT', desc: 'Standard cyan-dominant operations theme', color: '#06b6d4', group: 'Operational' },
    { id: 'matrix', name: 'MATRIX ENVIRO', desc: 'Emerald green high-contrast simulation', color: '#10b981', group: 'Operational' },
    { id: 'crimson', name: 'CRIMSON ALERT', desc: 'Red-dominant critical failure mode', color: '#f43f5e', group: 'Alert' },
    { id: 'quantum', name: 'QUANTUM FIELD', desc: 'Deep blue predictive processing', color: '#3b82f6', group: 'Analytical' },
    { id: 'holographic', name: 'HOLOGRAPHIC AI', desc: 'Translucent data-visuals and glassmorphism', color: '#2dd4bf', group: 'Futuristic' },
    { id: 'cyberpunk', name: 'CYBERPUNK NEURAL', desc: 'High-energy pink & yellow over pure black', color: '#ec4899', group: 'Futuristic' },
    { id: 'executive', name: 'EXECUTIVE COMMAND', desc: 'Premium luxury navy & gold dashboard', color: '#fbbf24', group: 'Executive' },
    { id: 'military', name: 'TACTICAL MILITARY', desc: 'High-contrast olive drab and amber operations', color: '#84cc16', group: 'Operational' },
    { id: 'neural', name: 'NEURAL STREAM', desc: 'Purple-dominant deep intelligence network', color: '#a855f7', group: 'Analytical' },
    { id: 'minimal', name: 'MINIMAL INTELLIGENCE', desc: 'Maximum contrast, distraction-free monochrome', color: '#94a3b8', group: 'Executive' },
    { id: 'light', name: 'LIGHT DAYLIGHT', desc: 'High-visibility daytime operational mode', color: '#cbd5e1', group: 'Operational' },
  ];

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#02040a]">
      {/* Background elements */}
      <div className="absolute inset-0 z-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-overlay"></div>
      
      {/* Header */}
      <header className="min-h-[4rem] px-4 md:px-8 py-6 border-b border-white/5 relative z-10 bg-[#02040a]/80 backdrop-blur-xl shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.5)] shrink-0"></div>
            <h1 className="text-lg md:text-xl font-display font-semibold tracking-wider text-slate-100 flex items-center gap-3 uppercase">
              <Settings2 className="text-cyan-400 shrink-0" size={24} />
              <span className="truncate">System Configuration</span>
            </h1>
          </div>
          <p className="text-[10px] md:text-xs font-mono text-slate-500 tracking-widest uppercase mt-2 ml-4">
            Global Environment & Theme Preferences
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="w-full px-2 md:px-8 mx-auto space-y-10">
          
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Palette className="text-cyan-400" size={20} />
              <h2 className="text-lg font-display tracking-widest text-slate-200">INTERFACE THEME</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex bg-[#0f172a]/40 flex-col items-start p-4 rounded-xl border text-left transition-all duration-300 relative overflow-hidden group",
                    theme === t.id 
                      ? "border-cyan-500/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.1),0_0_15px_rgba(6,182,212,0.2)]" 
                      : "border-white/5 hover:border-white/20 hover:bg-[#0f172a]/60"
                  )}
                >
                  {theme === t.id && (
                    <div className="absolute inset-0 bg-cyan-500/5"></div>
                  )}
                  <div className="flex items-center gap-3 mb-2 relative z-10 w-full">
                    <span className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: t.color }}></span>
                    <span className={cn(
                      "font-mono text-sm font-bold tracking-widest",
                      theme === t.id ? "text-cyan-400" : "text-slate-300"
                    )}>
                      {t.name}
                    </span>
                    {theme === t.id && (
                      <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono relative z-10 pl-6">
                    {t.desc}
                  </p>
                  
                </button>
              ))}
            </div>
          </section>
          
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Settings2 className="text-cyan-400" size={20} />
              <h2 className="text-lg font-display tracking-widest text-slate-200">AI COGNITIVE & PREFERENCES</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between bg-[#0f172a]/40 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-slate-200 font-mono">AUTONOMOUS AGENT SWARM</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">Allow agents to automatically resolve Low Risk incidents</p>
                </div>
                <div 
                  onClick={() => setIsAutonomousEnabled(!isAutonomousEnabled)}
                  className={cn("relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300", isAutonomousEnabled ? "bg-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5 border border-white/10")}
                >
                  <div className={cn("absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300", isAutonomousEnabled ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] translate-x-6" : "bg-slate-500")}></div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#0f172a]/40 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-slate-200 font-mono">PREDICTIVE STAGING ANALYSIS</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">Continuously analyze PP-EWM staging dependencies in background</p>
                </div>
                <div 
                  onClick={() => setIsPredictiveEnabled(!isPredictiveEnabled)}
                  className={cn("relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300", isPredictiveEnabled ? "bg-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5 border border-white/10")}
                >
                  <div className={cn("absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300", isPredictiveEnabled ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] translate-x-6" : "bg-slate-500")}></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-[#0f172a]/40 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-slate-200 font-mono">AI ADAPTIVE UI ENGINE</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">Intelligently balance layouts and typgraphic hierarchy</p>
                </div>
                <div 
                  onClick={() => setIsAdaptiveEngineEnabled(!isAdaptiveEngineEnabled)}
                  className={cn("relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300", isAdaptiveEngineEnabled ? "bg-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5 border border-white/10")}
                >
                  <div className={cn("absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300", isAdaptiveEngineEnabled ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] translate-x-6" : "bg-slate-500")}></div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#0f172a]/40 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-slate-200 font-mono">SPATIAL RONDERING ENGINE</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">Enable 3D Depth, Glassmorphism & GPU Acceleration</p>
                </div>
                <div 
                  onClick={() => setIsSpatialUiEnabled(!isSpatialUiEnabled)}
                  className={cn("relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300", isSpatialUiEnabled ? "bg-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5 border border-white/10")}
                >
                  <div className={cn("absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300", isSpatialUiEnabled ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] translate-x-6" : "bg-slate-500")}></div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#0f172a]/40 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold tracking-widest text-slate-200 font-mono">OSS NOTE AUTO-APPLY</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">Automatically download relevant SAP Notes to sandbox</p>
                </div>
                <div 
                  onClick={() => setIsOssNoteEnabled(!isOssNoteEnabled)}
                  className={cn("relative inline-block w-12 h-6 rounded-full cursor-pointer transition-colors duration-300", isOssNoteEnabled ? "bg-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5 border border-white/10")}
                >
                  <div className={cn("absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300", isOssNoteEnabled ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] translate-x-6" : "bg-slate-500")}></div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Shield className="text-cyan-400" size={20} />
              <h2 className="text-lg font-display tracking-widest text-slate-200">SECURITY & INTEGRATION</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex bg-[#0f172a]/40 flex-col items-start p-4 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 mb-2 w-full">
                  <Key size={16} className="text-amber-400" />
                  <span className="font-mono text-sm font-bold tracking-widest text-slate-300">SAP RFC CONNECTIONS</span>
                </div>
                <p className="text-xs text-slate-500 font-mono pl-7">Manage ERP & EWM destination configs</p>
              </div>

              <div className="flex bg-[#0f172a]/40 flex-col items-start p-4 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 mb-2 w-full">
                  <Monitor size={16} className="text-purple-400" />
                  <span className="font-mono text-sm font-bold tracking-widest text-slate-300">TELEMETRY ENDPOINTS</span>
                </div>
                <p className="text-xs text-slate-500 font-mono pl-7">Configure external monitoring webhooks</p>
              </div>

              <div 
                onClick={() => logOut()}
                className="flex bg-rose-500/10 flex-col items-start p-4 rounded-xl border border-rose-500/30 cursor-pointer hover:bg-rose-500/20 transition-all">
                <div className="flex items-center gap-3 mb-2 w-full">
                  <LogOut size={16} className="text-rose-400" />
                  <span className="font-mono text-sm font-bold tracking-widest text-rose-300">SECURE LOGOUT</span>
                </div>
                <p className="text-xs text-rose-500/70 font-mono pl-7">Disconnect from {user?.email}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
