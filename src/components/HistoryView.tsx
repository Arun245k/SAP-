import React, { useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ArrowRight, ArrowLeft, AlertOctagon, Bot, CloudUpload, RefreshCcw, Check, Copy, Mail, MessageCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResolutionTimeline } from './ResolutionTimeline';

export function HistoryView({
  incidents,
  searchQuery,
  setSearchQuery,
  sortConfig,
  handleSort,
  displayedIncidents,
  viewIncidentDetail,
  selectedIncident,
  openHistory,
  onArchive,
  isSyncing
}: any) {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const shareViaEmail = () => {
    if (!selectedIncident) return;
    const subject = encodeURIComponent(`Incident Report: ${selectedIncident.title || selectedIncident.problem.substring(0, 50)}`);
    const body = encodeURIComponent(
      `Problem:\n${selectedIncident.problem}\n\n` +
      `Root Cause:\n${selectedIncident.rootCause || 'N/A'}\n\n` +
      `Resolution:\n${selectedIncident.resolutionSteps || 'N/A'}\n\n` +
      `Analysis:\n${selectedIncident.analysis}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareViaWhatsApp = () => {
    if (!selectedIncident) return;
    const text = encodeURIComponent(
      `*Incident Report: ${selectedIncident.title || selectedIncident.problem.substring(0, 50)}*\n\n` +
      `*Problem:*\n${selectedIncident.problem}\n\n` +
      `*Root Cause:*\n${selectedIncident.rootCause || 'N/A'}\n\n` +
      `*Resolution:*\n${selectedIncident.resolutionSteps || 'N/A'}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (selectedIncident) {
    return (
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#02040a]">
        <header className="min-h-[4rem] flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-8 py-4 gap-4 border-b border-white/5 shrink-0 z-10 glass-panel">
          <div className="flex items-center space-x-2 md:space-x-4 max-w-full">
            <button onClick={openHistory} className="p-2 text-slate-400 hover:text-cyan-400 rounded-md transition-colors border border-transparent hover:border-cyan-500/30 shrink-0">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-[10px] md:text-xs font-display font-semibold text-slate-200 flex items-center truncate max-w-full tracking-widest uppercase">
              RECORD_ID <span className="text-cyan-500/50 ml-2 font-mono text-[8px] md:text-[10px] truncate">{selectedIncident.id.substring(0,8)}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={shareViaEmail}
                className="p-1.5 md:px-3 md:py-1.5 flex items-center justify-center gap-2 rounded-md border border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all font-mono text-[9px] tracking-widest uppercase"
                title="Share via Email"
              >
                <Mail size={12} />
                <span className="hidden md:inline">Email</span>
              </button>
              <button
                onClick={shareViaWhatsApp}
                className="p-1.5 md:px-3 md:py-1.5 flex items-center justify-center gap-2 rounded-md border border-slate-700/50 text-slate-400 hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/30 transition-all font-mono text-[9px] tracking-widest uppercase"
                title="Share via WhatsApp"
              >
                <MessageCircle size={12} />
                <span className="hidden md:inline">WhatsApp</span>
              </button>
            </div>
            
            <button
              onClick={() => onArchive?.(selectedIncident)}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono text-[9px] tracking-widest transition-all duration-300 ${
                isSyncing 
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 cursor-wait' 
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] shadow-[0_0_5px_rgba(6,182,212,0.1)]'
              }`}
            >
              {isSyncing ? (
                <RefreshCcw size={12} className="animate-spin" />
              ) : (
                <CloudUpload size={12} />
              )}
              {isSyncing ? 'SAVING...' : 'ARCHIVE TO VAULT'}
            </button>
            <span className="text-[8px] md:text-[9px] uppercase font-mono tracking-widest text-slate-500 hidden sm:inline">
              TS: {new Date(selectedIncident.timestamp).toISOString()}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-10 md:px-8 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="w-full px-4 md:px-8 mx-auto space-y-8">
            <div className="glass-card rounded-2xl overflow-hidden border border-white/10 cyber-border">
              <div className="bg-[#0f172a]/80 px-8 py-6 border-b border-white/5 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full filter blur-[20px] pointer-events-none"></div>
                <h2 className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center relative z-10">
                  <AlertOctagon size={14} className="mr-2" />
                  INCIDENT_TELEMETRY (Raw Input)
                </h2>
                <div className="text-slate-300 text-[13px] font-mono leading-relaxed whitespace-pre-wrap relative z-10 bg-[#02040a] p-4 rounded-lg border border-slate-800">{selectedIncident.problem}</div>
              </div>
              
              <div className="px-8 py-10 relative border-b border-white/5">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-8 relative z-10">
                  <h2 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center">
                    <Bot size={14} className="mr-2" />
                    SYSTEM_ANALYSIS_LOG
                  </h2>
                  <button 
                    onClick={() => copyToClipboard(selectedIncident.analysis, 'analysis')}
                    className="flex items-center text-xs font-mono text-cyan-500/70 hover:text-cyan-400 transition-colors"
                  >
                    {copiedSection === 'analysis' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                    {copiedSection === 'analysis' ? 'COPIED' : 'COPY'}
                  </button>
                </div>
                 <div className="prose prose-invert prose-sm max-w-none w-full overflow-x-auto relative z-10
                  prose-p:text-slate-300 prose-p:leading-relaxed
                  prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
                  prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
                  prose-li:my-1 prose-li:text-slate-300
                  prose-a:text-cyan-400 hover:prose-a:text-cyan-300
                  prose-strong:text-cyan-300 prose-strong:font-semibold prose-strong:tracking-wide
                  prose-code:text-rose-400 prose-code:bg-rose-400/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-rose-400/20 prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-[12px]
                  prose-pre:bg-[#0a0f1c] prose-pre:text-slate-300 prose-pre:p-4 prose-pre:rounded-xl prose-pre:border prose-pre:border-cyan-500/20 prose-pre:shadow-[0_0_15px_rgba(6,182,212,0.1)] prose-pre:my-4 prose-pre:overflow-x-auto
                  prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-widest prose-headings:uppercase prose-headings:text-cyan-400 prose-headings:mt-8 prose-headings:mb-4
                  prose-headings:border-b prose-headings:border-white/10 prose-headings:pb-2
                  prose-h1:text-[16px] prose-h2:text-[14px] prose-h3:text-[12px] prose-h4:text-[11px] prose-h5:text-[10px] prose-h6:text-[10px]
                  [&>h1]:flex [&>h1]:items-center [&>h1]:before:content-[''] [&>h1]:before:w-2 [&>h1]:before:h-2 [&>h1]:before:rounded-none [&>h1]:before:bg-cyan-500 [&>h1]:before:mr-3 [&>h1]:before:shadow-[0_0_8px_rgba(6,182,212,0.8)] [&>h1]:before:animate-pulse
                  [&>h2]:flex [&>h2]:items-center [&>h2]:before:content-[''] [&>h2]:before:w-1.5 [&>h2]:before:h-1.5 [&>h2]:before:rounded-none [&>h2]:before:bg-cyan-500 [&>h2]:before:mr-3 [&>h2]:before:shadow-[0_0_8px_rgba(6,182,212,0.8)]
                  [&>h3]:flex [&>h3]:items-center [&>h3]:before:content-[''] [&>h3]:before:w-1 [&>h3]:before:h-4 [&>h3]:before:rounded-none [&>h3]:before:bg-cyan-500/80 [&>h3]:before:mr-3
                  [&>ul>li]:marker:text-cyan-500/50 [&>ol>li]:marker:text-cyan-500/50
                  ">
                  <Markdown remarkPlugins={[remarkGfm]}>{selectedIncident.analysis}</Markdown>
                  <ResolutionTimeline markdownContent={selectedIncident.analysis || ""} messageId={selectedIncident.id} />
                </div>
              </div>

              {(selectedIncident.rootCause || selectedIncident.resolutionSteps) && (
                <div className="bg-[#0a0f1c]/50 px-8 py-6 relative grid grid-cols-1 md:grid-cols-2 gap-8">
                  {selectedIncident.rootCause && (
                    <div className="border border-white/5 bg-[#02040a]/50 p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest">
                          ROOT_CAUSE
                        </h3>
                        <button 
                          onClick={() => copyToClipboard(selectedIncident.rootCause, 'rootCause')}
                          className="flex items-center text-xs font-mono text-cyan-500/70 hover:text-cyan-400 transition-colors"
                        >
                          {copiedSection === 'rootCause' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                          {copiedSection === 'rootCause' ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                      <div className="text-slate-300 text-[12px] font-mono whitespace-pre-wrap">{selectedIncident.rootCause}</div>
                    </div>
                  )}
                  
                  {selectedIncident.resolutionSteps && (
                    <div className="border border-white/5 bg-[#02040a]/50 p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                          RESOLUTION_STEPS
                        </h3>
                        <button 
                          onClick={() => copyToClipboard(selectedIncident.resolutionSteps, 'resolution')}
                          className="flex items-center text-xs font-mono text-cyan-500/70 hover:text-cyan-400 transition-colors"
                        >
                          {copiedSection === 'resolution' ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                          {copiedSection === 'resolution' ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                      <div className="text-slate-300 text-[12px] font-mono whitespace-pre-wrap">{selectedIncident.resolutionSteps}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#02040a]">
       <header className="min-h-[4rem] flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-8 py-4 gap-4 border-b border-white/5 shrink-0 z-10 glass-panel">
        <h1 className="text-[10px] md:text-xs font-display font-semibold text-slate-200 flex items-center tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-3 animate-pulse glow-text-cyan shrink-0"></span>
          ENTERPRISE_DNA_MATRIX <span className="text-slate-500 ml-2 font-mono text-[8px] md:text-[10px] hidden sm:inline">STORED_INTELLIGENCE</span>
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="w-full px-4 md:px-8 mx-auto">
          <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-[400px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-cyan-500/50" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-3 py-2.5 border border-white/10 rounded-lg leading-5 bg-[#0a0f1c] placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-[#0f172a] text-[13px] font-mono text-slate-200 transition-all shadow-inner"
                placeholder="QUERY SELECT * FROM artificial_memory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase flex items-center bg-[#0a0f1c] px-3 py-1.5 rounded border border-white/5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
              SYNAPSES: <span className="text-emerald-400 ml-1 font-bold">{displayedIncidents.length}</span>
            </div>
          </div>

          {incidents.length === 0 ? (
            <div className="text-center py-24 glass-card rounded-2xl cyber-border">
              <div className="mx-auto w-16 h-16 bg-[#0a0f1c] border border-white/10 rounded-xl flex items-center justify-center mb-6 text-slate-600 shadow-inner">
                <Search size={20} />
              </div>
              <h3 className="text-[11px] font-mono tracking-widest text-slate-400 uppercase mb-2">SYNAPSE_NOT_FOUND</h3>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">No stored intelligence patterns in local cluster.</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-white/10 cyber-border">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/5">
                  <thead className="bg-[#0a0f1c]/80 border-b border-white/5">
                    <tr>
                      <th onClick={() => handleSort('title')} className="px-6 py-3.5 text-left text-[9px] font-mono text-cyan-500/70 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group">
                        <div className="flex items-center space-x-1"><span>Target</span>{sortConfig?.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-cyan-400"/> : <ChevronDown size={12} className="text-cyan-400"/>)}</div>
                      </th>
                      <th onClick={() => handleSort('problem')} className="px-6 py-3.5 text-left text-[9px] font-mono text-cyan-500/70 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden md:table-cell group">
                        <div className="flex items-center space-x-1"><span>Symptoms</span>{sortConfig?.key === 'problem' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-cyan-400"/> : <ChevronDown size={12} className="text-cyan-400"/>)}</div>
                      </th>
                      <th onClick={() => handleSort('rootCause')} className="px-6 py-3.5 text-left text-[9px] font-mono text-cyan-500/70 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell group">
                        <div className="flex items-center space-x-1"><span>Root Cause</span>{sortConfig?.key === 'rootCause' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-cyan-400"/> : <ChevronDown size={12} className="text-cyan-400"/>)}</div>
                      </th>
                      <th onClick={() => handleSort('resolutionSteps')} className="px-6 py-3.5 text-left text-[9px] font-mono text-cyan-500/70 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors hidden lg:table-cell group">
                        <div className="flex items-center space-x-1"><span>Resolution Steps</span>{sortConfig?.key === 'resolutionSteps' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-cyan-400"/> : <ChevronDown size={12} className="text-cyan-400"/>)}</div>
                      </th>
                      <th onClick={() => handleSort('timestamp')} className="px-6 py-3.5 text-left text-[9px] font-mono text-cyan-500/70 uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group">
                        <div className="flex items-center space-x-1"><span>Timestamp</span>{sortConfig?.key === 'timestamp' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-cyan-400"/> : <ChevronDown size={12} className="text-cyan-400"/>)}</div>
                      </th>
                      <th scope="col" className="relative px-6 py-3.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#02040a]/40">
                    {displayedIncidents.map((incident: any) => (
                      <tr key={incident.id} onClick={() => viewIncidentDetail(incident)} className="hover:bg-cyan-500/5 cursor-pointer transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-[12px] font-mono font-medium text-slate-300 line-clamp-1 group-hover:text-cyan-400 transition-colors">{incident.title}</div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <div className="text-[11px] font-mono text-slate-500 line-clamp-1">"{incident.problem}"</div>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="text-[11px] font-mono text-slate-500 line-clamp-1">{incident.rootCause || '-'}</div>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="text-[11px] font-mono text-slate-500 line-clamp-1">{incident.resolutionSteps || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-mono text-slate-500">
                          {new Date(incident.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-[9px] font-mono tracking-widest uppercase">
                          <span className="text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end">
                            READ <ArrowRight size={10} className="ml-1" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
