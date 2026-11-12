import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeSapIssue, analyzeSapIssueStream } from './services/geminiService';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';

// Direct high-reliability imports for immediate render and zero chunk fetch faults
import { CommandCenter } from './components/CommandCenter';
import { HistoryView } from './components/HistoryView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { OssNotesView } from './components/OssNotesView';
import { DocGeneratorView } from './components/DocGeneratorView';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { QueueAnalysisView } from './components/QueueAnalysisView';
import { EwmCommunityView } from './components/EwmCommunityView';

import { auth, db } from './lib/firebase';
import { logTelemetry } from './services/telemetryService';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Activity, LayoutDashboard, History, Settings, PlusSquare, Menu, FileText, CloudUpload, RefreshCw, Layers } from 'lucide-react';
import { cn } from './lib/utils';

function NexusSystemLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#02040a] text-cyan-400 font-mono relative overflow-hidden p-8 animate-fade-in duration-300">
      {/* Abstract Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#020a13_1px,transparent_1px),linear-gradient(to_bottom,#020a13_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
        {/* Futuristic glowing hexagonal spinner */}
        <div className="relative w-14 h-14 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 border border-cyan-500/10 rounded-full"></div>
          <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-ping"></div>
          <div className="absolute w-10 h-10 border-2 border-transparent border-t-cyan-500 border-b-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute w-6 h-6 border border-transparent border-l-cyan-400 border-r-cyan-400 rounded-full animate-pulse"></div>
        </div>

        {/* Operating status terms */}
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-bold mb-2">
          NEXUS OS // INTEGRITY CORE v2100
        </div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-6 font-semibold">
          COMPILING INTEGRATION MATRIX...
        </div>

        {/* Binary stream simulator */}
        <div className="bg-cyan-950/10 border border-cyan-500/10 rounded-lg p-3.5 w-full text-left space-y-1 mb-5 h-24 overflow-hidden shadow-[inset_0_0_15px_rgba(6,182,212,0.05)] backdrop-blur-md">
          <div className="text-[9px] text-cyan-400/80 animate-pulse flex items-center">
            <span className="text-emerald-500 mr-2">SYS</span> [CORE]: fetch_neural_modules [✓]
          </div>
          <div className="text-[9px] text-cyan-450/70 flex items-center">
            <span className="text-emerald-500 mr-2">SYS</span> [SCM]: compiling_observability_nodes [✓]
          </div>
          <div className="text-[9px] text-cyan-500/60 flex items-center">
             <span className="text-cyan-500 mr-2">NEXUS</span> [MAIN]: synchronizing space-time metrics...
          </div>
          <div className="text-[9px] text-cyan-500/30 flex items-center select-none font-mono tracking-wider overflow-hidden">
             100101011110001010011001011010
          </div>
        </div>

        {/* Progress percent indicator style */}
        <div className="w-full bg-slate-950 h-[3px] rounded-full overflow-hidden border border-white/5">
          <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full w-[70%] animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string; // Legacy support
  images?: string[]; 
  timestamp: Date;
};

export type ResolvedIncident = {
  id: string;
  title: string;
  problem: string;
  analysis: string;
  timestamp: number;
  rootCause?: string;
  resolutionSteps?: string;
};

const extractPreview = (text: string, sectionType: 'root' | 'resolution') => {
  const lines = text.split('\n');
  let isRecording = false;
  let content = '';

  const rootHeader = 'ROOT CAUSE';
  const resolutionHeader = 'RECOVERY PLAYBOOK';

  const targetHeader = sectionType === 'root' ? rootHeader : resolutionHeader;

  for (const line of lines) {
    if (!isRecording && line.toUpperCase().includes(targetHeader)) {
      isRecording = true;
      // If the header itself has content after a colon
      const afterColon = line.split(':');
      if (afterColon.length > 1 && afterColon.slice(1).join(':').trim()) {
          content += afterColon.slice(1).join(':').trim() + ' ';
      }
      continue;
    }

    if (isRecording) {
        // Stop if we hit another header or a major section divider
        if (/^#{1,4}\s/.test(line.trim())) {
            break;
        }
        content += line.trim() + ' ';
    }
  }

  const cleanContent = content.replace(/[*_#`]/g, '').trim();
  return cleanContent ? (cleanContent.length > 150 ? cleanContent.substring(0, 150) + '...' : cleanContent) : '-';
};

const START_MSG = `### 🌌 NEXUS OS 2100 // SYSTEM CONSCIOUSNESS ALIVE
> **ENTERPRISE SUPERINTELLIGENCE CORE ONLINE**
> Autonomous Agent Civilization: SYNCHRONIZED
> Predictive Quantum Universe: ACTIVE
> Neural Digital Twin: CONNECTED

Welcome to the future of enterprise operations. I am the cognitive intelligence brain of your global supply chain. 
I do not just monitor; I *learn*, *simulate*, and *orchestrate* autonomous recovery.

**ACTIVE INTELLIGENCE PROTOCOLS:**
- \`SMQ/IDOC\` Spatial-Temporal Threat Detection
- \`EWM/TM/PP\` Real-time Operational Universe Render
- \`QUANTUM\` Predictive Incident Simulation
- \`SAP OSS\` Autonomous Note Knowledge Graph & Reconciliation

Provide a data fragment, structural telemetry, or initiate a future-state simulation to engage the core matrix.
I am already analyzing inbound vectors... state your directive.`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: START_MSG,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; type: string; data: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<'chat' | 'history' | 'incident_detail' | 'dashboard' | 'settings' | 'oss_search' | 'doc_generator' | 'performance' | 'queue_analysis' | 'ewm_community'>('dashboard');
  const [ewmCommunityQuery, setEwmCommunityQuery] = useState<string>('');
  const [theme, setTheme] = useState('nexus');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const [incidents, setIncidents] = useState<ResolvedIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<ResolvedIncident | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'title' | 'problem' | 'timestamp' | 'rootCause' | 'resolutionSteps', direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const q = query(collection(db, 'archives'), where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const docs = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Use doc.id for absolute uniqueness while keeping metadata
            return {
              id: doc.id,
              title: data.title,
              problem: data.problem,
              analysis: data.analysis,
              timestamp: data.timestamp,
              rootCause: data.rootCause,
              resolutionSteps: data.resolutionSteps,
            } as ResolvedIncident;
          });
          
          setIncidents(docs.sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
          // Silent catch
        }
      } else {
        setIncidents([]); // clear incidents on logout
      }
    });

    return () => unsubscribe();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayedIncidents = useMemo(() => {
    let sorted = [...incidents];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(inc => 
        inc.title.toLowerCase().includes(q) || 
        inc.problem.toLowerCase().includes(q) ||
        inc.analysis.toLowerCase().includes(q)
      );
    }
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof ResolvedIncident];
        let bVal: any = b[sortConfig.key as keyof ResolvedIncident];
        
        if (sortConfig.key === 'rootCause') {
          aVal = (a.rootCause || extractPreview(a.analysis, 'root')).toLowerCase();
          bVal = (b.rootCause || extractPreview(b.analysis, 'root')).toLowerCase();
        } else if (sortConfig.key === 'resolutionSteps') {
          aVal = (a.resolutionSteps || extractPreview(a.analysis, 'resolution')).toLowerCase();
          bVal = (b.resolutionSteps || extractPreview(b.analysis, 'resolution')).toLowerCase();
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [incidents, searchQuery, sortConfig]);

  const handleSort = (key: 'title' | 'problem' | 'timestamp' | 'rootCause' | 'resolutionSteps') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (sortConfig && sortConfig.key === key) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachments(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            type: file.type,
            data: reader.result as string,
            name: file.name || 'Pasted_Content'
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') !== -1 || items[i].type === 'application/pdf') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const currentInput = input;
    const currentAttachments = [...attachments];

    const newUserMessage: Message = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: currentInput,
      images: currentAttachments.filter(a => a.type.startsWith('image/')).map(a => a.data),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    const startTime = Date.now();
    let response = '';
    let isSuccess: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
    const assistantMsgId = `a-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      // First attempt real-time token streaming for zero-latency user feedback
      let streamedAny = false;
      try {
        response = await analyzeSapIssueStream(
          currentInput,
          currentAttachments,
          (chunk) => {
            if (!streamedAny) {
              streamedAny = true;
              setMessages(prev => [...prev, {
                id: assistantMsgId,
                role: 'assistant',
                content: chunk,
                timestamp: new Date(),
              }]);
            } else {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m));
            }
          }
        );
      } catch (streamErr) {
        console.warn('Streaming bypassed or interrupted, falling back to direct analysis:', streamErr);
        response = await analyzeSapIssue(currentInput, currentAttachments);
        if (!streamedAny) {
          setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
          }]);
        } else {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: response } : m));
        }
      }

      // Auto-save search context
      const titleStr = currentInput.length > 50 ? currentInput.substring(0, 50) + '...' : currentInput;
      const newIncident: ResolvedIncident = {
        id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: titleStr,
        problem: currentInput,
        analysis: response,
        timestamp: Date.now(),
        rootCause: extractPreview(response, 'root'),
        resolutionSteps: extractPreview(response, 'resolution'),
      };
      setIncidents(prev => {
        if (prev.find(i => i.id === newIncident.id)) return prev;
        return [newIncident, ...prev];
      });

      // Store in auth if user exists
      if (auth.currentUser) {
        try {
          const archivesRef = collection(db, 'archives');
          await addDoc(archivesRef, {
            ...newIncident,
            userId: auth.currentUser.uid,
            archivedAt: serverTimestamp()
          });
        } catch (err) {
          // Silent catch
        }
      }
      isSuccess = 'SUCCESS';
    } catch (error) {
      isSuccess = 'FAILURE';
      const rawError = (error as Error)?.message || 'An unexpected anomaly occurred';
      const isAuthError = rawError.includes('API key') || rawError.includes('403') || rawError.includes('PERMISSION_DENIED') || rawError.includes('API_KEY');
      const isTimeout = rawError.includes('timed out') || rawError.includes('timeout') || rawError.includes('504');
      const isHighDemand = rawError.includes('503') || rawError.includes('demand') || rawError.includes('unavailable') || rawError.includes('429');

      let formattedMessage = '';
      if (isAuthError) {
        formattedMessage = `**SECURITY / CREDENTIAL NOTICE:** Unable to authenticate with the Gemini API (${rawError}).\n\nPlease ensure the \`GEMINI_API_KEY\` secret is correctly configured in your AI Studio project settings.`;
      } else if (isTimeout) {
        formattedMessage = `⚠️ **NEXUS ENGINE LATENCY NOTICE:** The AI model took longer than expected to formulate the extensive enterprise resolution (${rawError}).\n\n**Recommended Action:** Please retry your inquiry. The system timeout has been scaled up to 60 seconds to support comprehensive multi-section SAP analyses.`;
      } else if (isHighDemand) {
        formattedMessage = `⚡ **HIGH NEURAL TRAFFIC DETECTED:** Upstream AI clusters are experiencing momentary demand spikes (${rawError}).\n\n**Recommended Action:** Please re-send your message; multi-model automatic failover is active.`;
      } else {
        formattedMessage = `**SYSTEM ANOMALY:** ${rawError}\n\nPlease check network connectivity or retry the diagnostic sequence.`;
      }

      setMessages(prev => {
        // If an assistant message placeholder already existed, replace its content; otherwise append
        const exists = prev.some(m => m.id === assistantMsgId);
        if (exists) {
          return prev.map(m => m.id === assistantMsgId ? { ...m, content: formattedMessage } : m);
        }
        return [...prev, {
          id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant',
          content: formattedMessage,
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsLoading(false);
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      logTelemetry(
        'SAP Issue Analysis',
        currentInput.length + (currentAttachments?.reduce((acc, curr) => acc + (curr.data?.length || 0), 0) || 0),
        response.length,
        latencyMs,
        isSuccess
      ).catch(e => console.error("Telemetry failure: ", e));
    }
  };

  const handleQuickAction = (text: string) => setInput(text);

  const handleSaveToHistory = (assistantMessage: Message, userMessage?: Message) => {
    if (!userMessage) return;
    const titleStr = userMessage.content.length > 50 ? userMessage.content.substring(0, 50) + '...' : userMessage.content;
    const newIncident: ResolvedIncident = {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: titleStr,
      problem: userMessage.content,
      analysis: assistantMessage.content,
      timestamp: Date.now(),
      rootCause: extractPreview(assistantMessage.content, 'root'),
      resolutionSteps: extractPreview(assistantMessage.content, 'resolution'),
    };
    setIncidents(prev => [newIncident, ...prev]);
  };

  const startNewAnalysis = () => {
    setViewMode('chat');
    setMessages([{
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: START_MSG,
      timestamp: new Date(),
    }]);
  };

  const syncHistoryToCloud = async () => {
    if (!auth.currentUser || isSyncing) return;
    setIsSyncing(true);
    try {
      const q = query(collection(db, 'archives'), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          problem: data.problem,
          analysis: data.analysis,
          timestamp: data.timestamp,
          rootCause: data.rootCause,
          resolutionSteps: data.resolutionSteps,
        } as ResolvedIncident;
      });
      
      setIncidents(docs.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      alert('CRITICAL ERROR: Cloud matrix inaccessible.');
    } finally {
      setIsSyncing(false);
    }
  };

  const archiveIncident = async (incident: ResolvedIncident) => {
    if (!auth.currentUser || isSyncing) return;
    setIsSyncing(true);
    try {
      const archivesRef = collection(db, 'archives');
      await addDoc(archivesRef, {
        ...incident,
        userId: auth.currentUser.uid,
        archivedAt: serverTimestamp()
      });
      alert('FRAGMENT ARCHIVED: Intelligence recorded in Quantum Vault.');
    } catch (error) {
      alert('CRITICAL ERROR: Archive sequence failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const viewIncidentDetail = (incident: ResolvedIncident) => {
    setSelectedIncident(incident);
    setViewMode('incident_detail');
  };

  return (
    <div className="flex h-screen bg-[#02040a] text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-100 overflow-hidden relative">
      <div className="scanline"></div>
      <div className="absolute inset-0 z-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.02] mix-blend-overlay pointer-events-none"></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row h-full w-full overflow-hidden">
        <Sidebar 
          viewMode={viewMode}
          setViewMode={setViewMode}
          startNewAnalysis={startNewAnalysis}
          incidents={incidents}
          viewIncidentDetail={viewIncidentDetail}
        />

        <main className="flex-1 flex min-w-0 bg-transparent relative isolate h-full overflow-hidden flex-col md:flex-row">
          <div className="flex-1 relative overflow-hidden flex flex-col h-full">
            <ErrorBoundary onReset={() => setViewMode('dashboard')}>
              <React.Suspense fallback={<NexusSystemLoader />}>
                {viewMode === 'chat' && (
                  <CommandCenter 
                    messages={messages}
                    input={input}
                    setInput={setInput}
                    isLoading={isLoading}
                    attachments={attachments}
                    fileInputRef={fileInputRef}
                    handleImageUpload={handleImageUpload}
                    handlePaste={handlePaste}
                    handleDrop={handleDrop}
                    removeAttachment={removeAttachment}
                    handleSubmit={handleSubmit}
                    handleQuickAction={handleQuickAction}
                    handleSaveToHistory={handleSaveToHistory}
                    incidents={incidents}
                    messagesEndRef={messagesEndRef}
                  />
                )}

                {(viewMode === 'history' || viewMode === 'incident_detail') && (
                  <HistoryView 
                    incidents={incidents}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    displayedIncidents={displayedIncidents}
                    viewIncidentDetail={viewIncidentDetail}
                    selectedIncident={viewMode === 'incident_detail' ? selectedIncident : null}
                    openHistory={() => setViewMode('history')}
                    onArchive={archiveIncident}
                    isSyncing={isSyncing}
                  />
                )}

                {viewMode === 'dashboard' && (
                  <DashboardView 
                    incidents={incidents} 
                    viewIncidentDetail={viewIncidentDetail} 
                    onSync={syncHistoryToCloud}
                    isSyncing={isSyncing}
                  />
                )}

                {viewMode === 'settings' && (
                  <SettingsView theme={theme} setTheme={setTheme} />
                )}

                {viewMode === 'oss_search' && (
                  <OssNotesView />
                )}

                {viewMode === 'doc_generator' && (
                  <DocGeneratorView />
                )}

                {viewMode === 'performance' && (
                  <PerformanceDashboard />
                )}

                {viewMode === 'queue_analysis' && (
                  <QueueAnalysisView 
                    onNavigateToChat={(prompt) => {
                      setInput(prompt);
                      setViewMode('chat');
                    }}
                    onNavigateToEwmCommunity={(ewmQuery) => {
                      setEwmCommunityQuery(ewmQuery);
                      setViewMode('ewm_community');
                    }}
                  />
                )}

                {viewMode === 'ewm_community' && (
                  <EwmCommunityView 
                    initialQuery={ewmCommunityQuery}
                    onNavigateToChat={(prompt) => {
                      setInput(prompt);
                      setViewMode('chat');
                    }} 
                  />
                )}
              </React.Suspense>
            </ErrorBoundary>
            
            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden flex items-center justify-between px-4 py-3 bg-[#02040a]/95 backdrop-blur-xl border-t border-white/10 shrink-0 z-50 shadow-[0_0_30px_rgba(0,0,0,0.8)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button onClick={() => setViewMode('dashboard')} className={cn("flex flex-col items-center gap-1", viewMode === 'dashboard' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
                <LayoutDashboard size={18} />
                <span className="text-[8px] font-mono tracking-wider">UNIVERSE</span>
              </button>
              <button onClick={() => setViewMode('queue_analysis')} className={cn("flex flex-col items-center gap-1", viewMode === 'queue_analysis' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
                <Layers size={18} />
                <span className="text-[8px] font-mono tracking-wider">SMQ2</span>
              </button>
              <button onClick={startNewAnalysis} className="flex items-center justify-center -mt-6 w-11 h-11 bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md">
                <PlusSquare size={20} className="relative z-10" />
              </button>
              <button onClick={() => setViewMode('chat')} className={cn("flex flex-col items-center gap-1", viewMode === 'chat' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
                <Activity size={18} />
                <span className="text-[8px] font-mono tracking-wider">NEURAL</span>
              </button>
              <button onClick={() => setViewMode('history')} className={cn("flex flex-col items-center gap-1", viewMode === 'history' || viewMode === 'incident_detail' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
                <History size={18} />
                <span className="text-[8px] font-mono tracking-wider">DNA LOG</span>
              </button>
              <button onClick={() => setViewMode('settings')} className={cn("flex flex-col items-center gap-1", viewMode === 'settings' ? "text-cyan-400" : "text-slate-500 hover:text-slate-300")}>
                <Settings size={18} />
                <span className="text-[8px] font-mono tracking-wider">CORE</span>
              </button>
            </nav>
          </div>
        </main>
      </div>
    </div>
  );
}
