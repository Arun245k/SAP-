import React from 'react';
import { Activity, LayoutDashboard, History, Settings, PlusSquare, AlertOctagon, Terminal, FileText, Bookmark, Cpu, Layers, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  viewMode: 'chat' | 'history' | 'incident_detail' | 'dashboard' | 'settings' | 'oss_search' | 'doc_generator' | 'performance' | 'queue_analysis' | 'ewm_community';
  setViewMode: (mode: 'chat' | 'history' | 'incident_detail' | 'dashboard' | 'settings' | 'oss_search' | 'doc_generator' | 'performance' | 'queue_analysis' | 'ewm_community') => void;
  startNewAnalysis: () => void;
  incidents: any[];
  viewIncidentDetail: (inc: any) => void;
}

export function Sidebar({ viewMode, setViewMode, startNewAnalysis, incidents, viewIncidentDetail }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#02040a]/95 backdrop-blur-3xl border-r border-white/5 hidden md:flex flex-col shrink-0 z-20 relative">
      <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
      
      <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0 relative">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-950 to-blue-950 border border-cyan-500/30 flex items-center justify-center mr-3 relative overflow-hidden group">
          <div className="absolute inset-0 bg-cyan-400/20 blur-xl group-hover:bg-cyan-400/40 transition-all"></div>
          <Terminal size={16} className="text-cyan-400 relative z-10" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-semibold text-slate-100 tracking-wider text-[13px] whitespace-nowrap glow-text-cyan flex items-center gap-1">
            NEXUS <span className="text-cyan-500 font-mono text-[10px]">OS</span>
          </span>
          <span className="text-[8px] uppercase tracking-[0.2em] text-slate-500 font-mono">SAP Ops Intelligence</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <button 
          onClick={startNewAnalysis}
          className="w-full flex items-center justify-center space-x-2 bg-cyan-500/10 hover:bg-cyan-500/20 cyber-border text-cyan-400 py-3 px-4 rounded-lg transition-all duration-300 font-medium text-[13px] mb-8 group"
        >
          <PlusSquare size={14} className="group-hover:scale-110 transition-transform" />
          <span className="font-mono tracking-wider uppercase text-[11px]">Deploy Neural Agent</span>
        </button>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-slate-600 font-mono font-bold mb-3 px-2 flex items-center">
              <span className="w-1 h-1 bg-slate-600 rounded-full mr-2"></span>
              Quantum Terminals
            </h3>
            <nav className="space-y-1">
              <button 
                onClick={() => setViewMode('chat')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'chat' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <Activity size={16} className={cn("mr-3", viewMode === 'chat' ? "text-cyan-400" : "text-slate-500")} />
                Error Intelligence AI
              </button>
              <button 
                onClick={() => setViewMode('dashboard')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'dashboard' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <LayoutDashboard size={16} className={cn("mr-3", viewMode === 'dashboard' ? "text-cyan-400" : "text-slate-500")} />
                Operational Universe
              </button>
              <button 
                onClick={() => setViewMode('history')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'history' || viewMode === 'incident_detail' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <History size={16} className={cn("mr-3", viewMode === 'history' || viewMode === 'incident_detail' ? "text-cyan-400" : "text-slate-500")} />
                Enterprise DNA Matrix
              </button>
              <button 
                onClick={() => setViewMode('oss_search')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'oss_search' ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <FileText size={16} className={cn("mr-3", viewMode === 'oss_search' ? "text-amber-400" : "text-slate-500")} />
                SAP OSS Repository
              </button>
              <button 
                onClick={() => setViewMode('doc_generator')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'doc_generator' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <Bookmark size={16} className={cn("mr-3", viewMode === 'doc_generator' ? "text-cyan-400" : "text-slate-500")} />
                SCM Specification Studio
              </button>
              <button 
                onClick={() => setViewMode('performance')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'performance' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <Cpu size={16} className={cn("mr-3", viewMode === 'performance' ? "text-cyan-400" : "text-slate-500")} />
                Performance Monitor
              </button>
              <button 
                onClick={() => setViewMode('queue_analysis')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'queue_analysis' ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <Layers size={16} className={cn("mr-3", viewMode === 'queue_analysis' ? "text-cyan-400" : "text-slate-500")} />
                SMQ2 Queue Analysis
              </button>
              <button 
                onClick={() => setViewMode('ewm_community')}
                className={cn("w-full flex items-center px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200", viewMode === 'ewm_community' ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]" : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent")}
              >
                <Globe size={16} className={cn("mr-3", viewMode === 'ewm_community' ? "text-emerald-400" : "text-slate-500")} />
                <span className="truncate">EWM Community Hub</span>
                <span className="ml-auto text-[7.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">LIVE</span>
              </button>
            </nav>
          </div>
          
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-cyan-500/50 font-mono font-semibold mb-3 px-2 flex items-center justify-between">
              Autonomous Log
              <span className="w-2 h-2 rounded-full border border-cyan-600 flex items-center justify-center font-mono text-[7px]" title="Auto-learning active">+</span>
            </h3>
            <nav className="space-y-1">
              {incidents.slice(0, 4).map(inc => (
                <button 
                  key={inc.id}
                  onClick={() => viewIncidentDetail(inc)}
                  className="w-full text-left block px-3 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-md truncate transition-colors border-l-2 border-transparent hover:border-cyan-500/50 hover:bg-white/5"
                >
                  {inc.title}
                </button>
              ))}
              {incidents.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-slate-600 font-mono">System standby...</div>
              )}
            </nav>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-white/5 bg-[#02040a] shrink-0">
        <button 
          onClick={() => setViewMode('settings')}
          className={cn(
            "flex items-center px-3 py-2.5 text-sm rounded-md w-full transition-colors border group",
            viewMode === 'settings' 
              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]" 
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent hover:border-white/10"
          )}
        >
          <Settings size={16} className={cn("mr-3 transition-colors", viewMode === 'settings' ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300")} />
          Settings
        </button>
      </div>
    </aside>
  );
}
