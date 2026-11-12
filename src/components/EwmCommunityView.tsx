import React, { useState, useEffect } from 'react';
import { 
  Search, ExternalLink, Globe, Sparkles, Copy, Check, FileText, 
  Layers, Lightbulb, Wrench, ShieldAlert, BookOpen, RefreshCw, 
  ArrowRight, CheckCircle2, ChevronRight, Share2, Tag, Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  findEwmCommunitySolution, 
  getEwmCommunityHub, 
  EwmSolutionResult, 
  EwmPopularTopic 
} from '../services/geminiService';
import { generateChatSessionPDF } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';

interface EwmCommunityViewProps {
  onNavigateToChat?: (prompt: string) => void;
  initialQuery?: string;
}

const OFFICIAL_EWM_HUB_URL = 'https://community.sap.com/t5/c-khhcw49343/SAP+Extended+Warehouse+Management/pd-p/01200615320800000705';

const EWM_CATEGORIES = [
  'All Domains',
  'Inbound (/SCWM/PRDI)',
  'Outbound (/SCWM/PRDO)',
  'Storage Control (POSC/LOSC)',
  'Wave Management',
  'RF Framework (/SCWM/RFUI)',
  'TM Integration (ASR)',
  'MFS / Automation'
];

export function EwmCommunityView({ onNavigateToChat, initialQuery }: EwmCommunityViewProps) {
  const [query, setQuery] = useState(initialQuery || '');
  const [urlInput, setUrlInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Domains');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EwmSolutionResult | null>(null);
  const [popularTopics, setPopularTopics] = useState<EwmPopularTopic[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch popular topics from backend on mount
  useEffect(() => {
    let isMounted = true;
    getEwmCommunityHub().then(info => {
      if (isMounted && info.popularTopics?.length > 0) {
        setPopularTopics(info.popularTopics);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // If initialQuery was passed, trigger search automatically
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (overrideQuery?: string, overrideUrl?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim();
    const u = (overrideUrl !== undefined ? overrideUrl : urlInput).trim();

    if (!q && !u) return;

    try {
      setIsLoading(true);
      setError(null);
      const categoryParam = selectedCategory === 'All Domains' ? undefined : selectedCategory;
      const data = await findEwmCommunitySolution({
        query: q,
        url: u || (q.includes('community.sap.com') ? q : undefined),
        category: categoryParam,
      });
      setResult(data);
    } catch (err: any) {
      console.error('EWM Community solution search failed:', err);
      setError(err?.message || 'Failed to retrieve solution from SAP EWM Community backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportPDF = () => {
    if (!result) return;
    const formattedMessages = [
      {
        id: 'user-ewm-query',
        role: 'user' as const,
        content: `SAP Extended Warehouse Management (EWM) Community Solution Query:\n"${query || urlInput}"\nCategory: ${selectedCategory}`,
        timestamp: new Date()
      },
      {
        id: 'assistant-ewm-solution',
        role: 'assistant' as const,
        content: `### 🎯 SAP EWM COMMUNITY RESOLUTION REPORT
**Official Reference**: [SAP Extended Warehouse Management Hub](${OFFICIAL_EWM_HUB_URL})  
**Generated On**: ${new Date(result.timestamp).toUTCString()}  

${result.solution}

---
#### 📚 COMMUNITY CITATIONS & SOURCES
${result.communitySources.map(s => `- [${s.title}](${s.url}) ${s.snippet ? `— *${s.snippet}*` : ''}`).join('\n')}`,
        timestamp: new Date()
      }
    ];

    generateChatSessionPDF({
      messages: formattedMessages,
      sessionTitle: `SAP EWM COMMUNITY SOLUTION - ${query.substring(0, 30).toUpperCase() || 'EWM PROTOCOL'}`,
      analystName: "Principal SAP EWM Integration Architect",
      systemTag: "#SAP-EWM-COMMUNITY",
      includeSignatures: true
    });
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-transparent">
      {/* Background atmosphere */}
      <div className="absolute top-0 right-0 w-[50vh] h-[50vh] radial-bg pointer-events-none opacity-40 z-0"></div>
      <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none z-0"></div>

      {/* Header Bar */}
      <header className="min-h-[4.2rem] flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 md:px-8 py-3.5 gap-4 border-b border-white/5 shrink-0 z-10 glass-panel relative">
        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"></div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Globe size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-display font-bold text-white tracking-widest uppercase">
                SAP EWM COMMUNITY INTELLIGENCE // SOLUTION ENGINE
              </h1>
              <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                SEARCH GROUNDING ONLINE
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider">
              GROUNDED IN OFFICIAL SAP EWM COMMUNITY HUB: <span className="text-cyan-300 font-semibold">pd-p/01200615320800000705</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={OFFICIAL_EWM_HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all font-bold"
            title="Open the official SAP Extended Warehouse Management Community in a new tab"
          >
            <ExternalLink size={12} />
            <span>OPEN OFFICIAL SAP EWM HUB</span>
          </a>

          {result && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all font-bold"
              title="Export solution runbook as enterprise PDF"
            >
              <FileText size={12} />
              <span>EXPORT SOLUTION PDF</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">

        {/* Hero Search Box */}
        <div className="glass-card p-5 md:p-6 rounded-2xl border border-white/10 space-y-4 shadow-[0_0_35px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={13} className="text-amber-400" />
              <span>SEARCH SAP EXTENDED WAREHOUSE MANAGEMENT COMMUNITY DISCUSSIONS & BEST PRACTICES</span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
              Query the official SAP EWM Community to extract verified solutions, SPRO customizing paths, function modules, and recommended OSS notes for warehouse processes, delivery replications, and RF scanners.
            </p>
          </div>

          {/* Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask any EWM question or paste an error (e.g. 'Warehouse process type missing in /SCWM/PRDI', or 'POSC step failure')..."
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 font-sans focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || (!query.trim() && !urlInput.trim())}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-display font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-black" />
                    <span>SYNTHESIZING...</span>
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    <span>FIND SOLUTION</span>
                  </>
                )}
              </button>
            </div>

            {/* Optional Specific Community URL input */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Optional: Direct SAP Community thread URL (e.g. https://community.sap.com/t5/...)"
                  className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/5 rounded-lg text-[10px] text-slate-300 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput('')}
                  className="text-[9px] text-slate-500 hover:text-slate-300 font-mono px-2 py-1"
                >
                  CLEAR
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mr-1">DOMAIN:</span>
              {EWM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider transition-all border",
                    selectedCategory === cat
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)] font-bold"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </form>
        </div>

        {/* Popular EWM Community Topics / Quick-Launch Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BookOpen size={12} className="text-cyan-400" />
              FREQUENT SAP EWM COMMUNITY SCENARIOS
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              CLICK TO INSTANTLY GENERATE RESOLUTION
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {popularTopics.map((topic, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(topic.query);
                  handleSearch(topic.query);
                }}
                className="p-3.5 rounded-xl bg-black/40 hover:bg-cyan-950/20 border border-white/5 hover:border-cyan-500/40 text-left transition-all duration-200 group flex flex-col justify-between space-y-2 shadow-[0_0_15px_rgba(0,0,0,0.3)]"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                      {topic.category}
                    </span>
                    <span className="text-[8.5px] font-mono font-bold text-slate-400 group-hover:text-cyan-300">
                      {topic.tcode}
                    </span>
                  </div>
                  <h4 className="text-[11px] font-display font-semibold text-white group-hover:text-cyan-200 line-clamp-2">
                    {topic.title}
                  </h4>
                </div>
                
                <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 group-hover:text-cyan-400 pt-1">
                  <span>Solve with Community Intelligence</span>
                  <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3 text-rose-300 text-xs font-mono">
            <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">COMMUNITY BACKEND QUERY EXCEPTION:</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Solution Results Display */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="glass-card rounded-2xl border border-cyan-500/30 p-6 space-y-6 relative overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)]"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>

              {/* Solution Header & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                        SAP EWM COMMUNITY SOLUTION PLAYBOOK
                      </h3>
                      <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                        COMMUNITY GROUNDED
                      </span>
                    </div>
                    <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                      Query: <span className="text-slate-200">"{query || urlInput}"</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      copyToClipboard(result.solution, 'ewm-sol');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    {copiedId === 'ewm-sol' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedId === 'ewm-sol' ? 'COPIED TO CLIPBOARD' : 'COPY RUNBOOK'}</span>
                  </button>

                  {onNavigateToChat && (
                    <button
                      onClick={() => {
                        const prompt = `Following up on this SAP EWM Community resolution:\n\nQuery: ${query || urlInput}\n\nSolution Summary:\n${result.solution.substring(0, 500)}...\n\nPlease assist with implementation details.`;
                        onNavigateToChat(prompt);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all font-bold"
                    >
                      <Terminal size={12} />
                      <span>OPEN IN NEURAL CHAT</span>
                    </button>
                  )}
                </div>
              </div>

              {/* T-Codes & Metadata Summary Bar */}
              {((result.tcodes && result.tcodes.length > 0) || (result.ossNotes && result.ossNotes.length > 0)) && (
                <div className="p-3 bg-black/50 border border-white/10 rounded-xl flex items-center justify-between gap-4 flex-wrap text-[9.5px] font-mono">
                  {result.tcodes && result.tcodes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500 uppercase">IDENTIFIED T-CODES:</span>
                      {result.tcodes.slice(0, 6).map(tc => (
                        <span key={tc} className="px-2 py-0.5 rounded bg-white/10 text-cyan-300 border border-white/15 font-bold">
                          {tc}
                        </span>
                      ))}
                    </div>
                  )}

                  {result.ossNotes && result.ossNotes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500 uppercase">REFERENCED OSS NOTES:</span>
                      {result.ossNotes.map(n => (
                        <span key={n} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Main Markdown Body */}
              <div className="prose prose-invert prose-sm max-w-none 
                prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-[11px] prose-p:font-sans
                prose-headings:font-display prose-headings:text-cyan-400 prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-[12px]
                prose-strong:text-cyan-300
                prose-code:text-rose-300 prose-code:bg-rose-950/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[10px]
                prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10
                prose-ul:text-[11px] prose-ol:text-[11px]
              ">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {result.solution}
                </Markdown>
              </div>

              {/* Clickable Grounded SAP Community & Documentation Sources */}
              {result.communitySources && result.communitySources.length > 0 && (
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Share2 size={13} className="text-cyan-400" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300 font-bold">
                      GROUNDED SAP COMMUNITY CITATIONS & THREAD REFERENCES ({result.communitySources.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {result.communitySources.map((source, sIdx) => (
                      <a
                        key={sIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-black/40 hover:bg-cyan-950/30 border border-white/5 hover:border-cyan-500/40 text-left transition-all duration-200 group flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <span className="text-[10px] font-semibold text-cyan-300 group-hover:text-cyan-200 truncate block">
                            {source.title}
                          </span>
                          {source.snippet && (
                            <p className="text-[8.5px] text-slate-400 line-clamp-2 font-sans">
                              {source.snippet}
                            </p>
                          )}
                          <span className="text-[7.5px] font-mono text-slate-500 truncate block group-hover:text-cyan-400/80">
                            {source.url}
                          </span>
                        </div>
                        <ExternalLink size={12} className="text-slate-500 group-hover:text-cyan-400 shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default EwmCommunityView;
