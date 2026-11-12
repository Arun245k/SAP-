import React, { useRef, useState, useEffect } from 'react';
import { 
  Bot, Send, Paperclip, X, Loader2, ArrowRight, Bookmark, Check, 
  FileImage, ShieldAlert, Mic, MicOff, FileDown, FileText, Download, 
  Sparkles, Sliders, CheckCircle2, AlertCircle, ChevronDown, CheckSquare, Square
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ResolutionTimeline } from './ResolutionTimeline';
import { generateChatSessionPDF } from '../utils/pdfGenerator';

export function CommandCenter({
  messages,
  input,
  setInput,
  isLoading,
  attachments,
  fileInputRef,
  handleImageUpload,
  handlePaste,
  handleDrop,
  removeAttachment,
  handleSubmit,
  handleQuickAction,
  handleSaveToHistory,
  incidents,
  messagesEndRef
}: any) {
  const [loadingText, setLoadingText] = useState("DECODING THREAT VECTOR...");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // PDF Export States
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalAnalyst, setModalAnalyst] = useState("Lead SCM Solutions Architect");
  const [modalScope, setModalScope] = useState<'all' | 'latest'>('all');
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Auto-detect SAP Modules in current session for badge display
  const sessionModules = React.useMemo(() => {
    const fullText = (messages || []).map((m: any) => m.content || '').join(' ');
    const detected: string[] = [];
    if (/EWM|Warehouse|\/SCWM\//i.test(fullText)) detected.push('EWM');
    if (/\bTM\b|Freight|Transportation/i.test(fullText)) detected.push('TM');
    if (/\bMM\b|Purchasing|MIGO|ME21N/i.test(fullText)) detected.push('MM');
    if (/\bSD\b|Sales|Delivery|VL02N/i.test(fullText)) detected.push('SD');
    if (/\bPP\b|Production|Staging/i.test(fullText)) detected.push('PP');
    if (/Basis|Short Dump|ST22|SM12|SM21/i.test(fullText)) detected.push('Basis');
    if (/\bFI\b|\bCO\b|Financials/i.test(fullText)) detected.push('FI/CO');
    return detected.length > 0 ? detected : ['S/4HANA', 'SCM'];
  }, [messages]);

  const openExportModal = (scope: 'all' | 'latest' = 'all') => {
    const userMsgs = (messages || []).filter((m: any) => m.role === 'user');
    let defaultTitle = "SAP COGNITIVE ROOT CAUSE & INCIDENT REMEDIATION REPORT";
    if (userMsgs.length > 0) {
      const firstLine = userMsgs[0].content.split('\n')[0].replace(/[#*`]/g, '').trim();
      if (firstLine) {
        defaultTitle = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
      }
    }
    setModalTitle(defaultTitle);
    setModalScope(scope);
    setIsExportModalOpen(true);
  };

  const handleExecuteExport = () => {
    if (!messages || messages.length === 0) return;
    try {
      setIsExporting(true);
      let msgsToExport = [...messages];
      if (modalScope === 'latest') {
        const lastAssistantIdx = messages.map((m: any) => m.role).lastIndexOf('assistant');
        if (lastAssistantIdx >= 0) {
          const prevUser = messages[lastAssistantIdx - 1];
          msgsToExport = prevUser ? [prevUser, messages[lastAssistantIdx]] : [messages[lastAssistantIdx]];
        }
      }

      generateChatSessionPDF({
        messages: msgsToExport,
        sessionTitle: modalTitle.trim() || "SAP SUPPLY CHAIN ROOT CAUSE ANALYSIS REPORT",
        analystName: modalAnalyst.trim() || "Lead SCM Solutions Architect",
        systemTag: "#OP-2100-ALPHA",
        includeSignatures
      });

      setIsExportModalOpen(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error("PDF Export generation failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickDirectExport = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!messages || messages.length === 0) return;
    try {
      setIsExporting(true);
      const userMsgs = messages.filter((m: any) => m.role === 'user');
      const firstPrompt = userMsgs[0]?.content ? userMsgs[0].content.split('\n')[0].replace(/[#*`]/g, '').trim() : "";
      const exportTitle = firstPrompt ? (firstPrompt.length > 60 ? firstPrompt.slice(0, 60) + '...' : firstPrompt) : "SAP COGNITIVE INCIDENT ANALYSIS REPORT";

      generateChatSessionPDF({
        messages,
        sessionTitle: exportTitle,
        analystName: modalAnalyst || "Lead SCM Solutions Architect",
        systemTag: "#OP-2100-ALPHA",
        includeSignatures: true
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error("Quick PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTurn = (assistantMsg: any, userMsg?: any) => {
    try {
      setIsExporting(true);
      const turnTitle = userMsg?.content 
        ? userMsg.content.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 60)
        : "SAP INCIDENT RESOLUTION PROTOCOL";

      generateChatSessionPDF({
        messages: userMsg ? [userMsg, assistantMsg] : [assistantMsg],
        sessionTitle: turnTitle || "SAP INCIDENT REMEDIATION PLAYBOOK",
        analystName: modalAnalyst || "Lead SCM Solutions Architect",
        systemTag: "#OP-NODE-PLAYBOOK",
        includeSignatures: true
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error("Single turn PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("WEB_SPEECH_API_NOT_SUPPORTED");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error(e);
        }
      }
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript;
            }
          }
          if (currentTranscript) {
            setInput((prev: string) => {
              const trimmed = prev.trim();
              return trimmed ? trimmed + ' ' + currentTranscript.trim() : currentTranscript.trim();
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          if (event.error === 'not-allowed') {
            setSpeechError("MICROPHONE_ACCESS_BLOCKED");
          } else if (event.error === 'no-speech') {
            // Quietly ignore
          } else {
            setSpeechError(`SPEECH_ERROR_${event.error.toUpperCase()}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error(err);
        setSpeechError("INITIALIZATION_FAILED");
        setIsListening(false);
      }
    }
  };

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingText("DECODING THREAT VECTOR...");
      return;
    }
    
    const texts = [
      "DECODING THREAT VECTOR...",
      "MAPPING MULTI-DIMENSIONAL CONTEXT...",
      "BUILDING DECISION TREE...",
      "SYNTHESIZING ROOT CAUSE...",
      "GENERATING RECOVERY PLAYBOOK...",
      "CALCULATING QUANTUM CONFIDENCE..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-transparent">
      {/* Background Decorative */}
      <div className="absolute top-0 right-0 w-[50vh] h-[50vh] radial-bg pointer-events-none opacity-50 z-0"></div>
      <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none z-0"></div>
      <div className="scanline"></div>

      {/* Header */}
      <header className="min-h-[4rem] flex flex-col md:flex-row justify-between items-start md:items-center px-4 md:px-8 py-3.5 gap-4 border-b border-white/5 shrink-0 z-10 glass-panel relative">
        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"></div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[10px] md:text-xs font-display font-semibold text-slate-200 flex items-center tracking-widest uppercase truncate max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2.5 animate-pulse glow-text-cyan shrink-0"></span>
            CONSCIOUS_THREAD <span className="text-cyan-500/50 ml-2 font-mono text-[8px] md:text-[10px] hidden sm:inline">#OP-2100-ALPHA</span>
          </h1>
          {sessionModules.map((mod: string) => (
            <span key={mod} className="hidden lg:inline text-[7.5px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase tracking-wider">
              {mod}
            </span>
          ))}
        </div>
        <div className="flex items-center space-x-2 md:space-x-3 max-w-full overflow-x-auto scrollbar-none pb-1 md:pb-0">
          <span className="flex items-center text-[8px] md:text-[9px] font-mono tracking-widest uppercase px-2 md:px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20 backdrop-blur-md shrink-0">
            <span className="w-1.5 h-1.5 bg-purple-400 mr-1 md:mr-2 shadow-[0_0_5px_#a855f7] animate-pulse"></span>
            NEURAL_NET_LIVE
          </span>
          <span className="flex items-center text-[8px] md:text-[9px] font-mono tracking-widest uppercase px-2 md:px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 backdrop-blur-md shrink-0">
            <span className="w-1.5 h-1.5 bg-emerald-400 mr-1 md:mr-2 shadow-[0_0_5px_#34d399]"></span>
            EWM_QUANTUM_STABLE
          </span>

          {/* Export PDF Button Group */}
          <div className="flex items-center shrink-0 rounded border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)] overflow-hidden">
            <button
              type="button"
              onClick={() => openExportModal('all')}
              disabled={isExporting || (messages || []).length === 0}
              title="Configure and Export current chat session as a formatted enterprise PDF"
              className={cn(
                "flex items-center text-[8px] md:text-[9px] font-mono tracking-widest uppercase px-2.5 md:px-3 py-1 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                isExporting && "animate-pulse"
              )}
            >
              {isExporting ? (
                <Loader2 size={11} className="mr-1.5 animate-spin text-cyan-400" />
              ) : (
                <FileDown size={11} className="mr-1.5 text-cyan-400" />
              )}
              <span>{isExporting ? "GENERATING..." : "EXPORT_SESSION_PDF"}</span>
              {(messages || []).length > 1 && (
                <span className="ml-1.5 px-1 py-0.2 rounded bg-cyan-500/30 text-[7px] text-cyan-200 font-bold">
                  {(messages || []).length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleQuickDirectExport}
              disabled={isExporting || (messages || []).length === 0}
              title="Instant 1-Click PDF Download"
              className="px-2 py-1 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/30 border-l border-cyan-500/30 transition-colors disabled:opacity-40"
            >
              <Download size={11} />
            </button>
          </div>
        </div>
      </header>

      {/* Export Success Feedback Toast */}
      <AnimatePresence>
        {exportSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="z-20 px-4 md:px-8 py-2 bg-emerald-950/60 border-b border-emerald-500/40 backdrop-blur-md flex items-center justify-between text-emerald-300 text-[10px] font-mono tracking-wider shadow-[0_4px_20px_rgba(16,185,129,0.15)]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span>ENTERPRISE PDF EXPORT GENERATED & DOWNLOADED // ARCHIVAL AUDIT TRAIL CERTIFIED</span>
            </div>
            <button onClick={() => setExportSuccess(false)} className="text-emerald-400/60 hover:text-emerald-300 p-1">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent z-10">
        <div className="w-full px-4 md:px-8 mx-auto space-y-12 pb-10">
          {messages.map((message: any, index: number) => {
            const isSaved = message.role === 'assistant' && incidents.some((inc: any) => inc.analysis === message.content);
            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{ willChange: "transform, opacity" }}
                key={message.id}
                className={cn("flex flex-col relative", message.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div className={cn("flex max-w-[95%] md:max-w-[85%] gap-4", message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={cn(
                    "w-9 h-9 rounded flex items-center justify-center shrink-0 my-1 font-display relative z-10",
                    message.role === 'assistant' 
                      ? "bg-[#02040a] border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                      : "bg-[#0f172a] border border-slate-700 text-slate-400"
                  )}>
                    {message.role === 'assistant' ? <Bot size={16} /> : <span className="text-[8px] font-bold tracking-wider">HUMAN</span>}
                  </div>
                  
                  <div className={cn(
                    "flex flex-col relative z-10 w-full min-w-0",
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}>
                    <div className={cn(
                      "rounded-xl px-6 py-5 backdrop-blur-xl font-sans text-[14px] leading-relaxed w-full",
                      message.role === 'user' 
                        ? "bg-[#0f172a]/60 text-slate-300 ml-12 border border-slate-700/50" 
                        : "glass-card mr-12 text-slate-300 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-white/5"
                    )}>
                      {message.imageUrl && !message.images && (
                        <div className="mb-4 max-w-sm rounded-lg overflow-hidden border border-white/10 bg-black p-1">
                          <img src={message.imageUrl} alt="Uploaded screen" className="w-full h-auto object-contain rounded-md opacity-90" />
                        </div>
                      )}

                      {message.images && message.images.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {message.images.map((img: string, i: number) => (
                            <div key={i} className="max-w-[150px] rounded-lg overflow-hidden border border-white/10 bg-black p-0.5">
                              <img src={img} alt={`Uploaded screen ${i}`} className="w-full h-auto object-contain rounded-md opacity-90 hover:opacity-100 transition-opacity cursor-zoom-in" onClick={() => window.open(img, '_blank')} />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {message.role === 'assistant' ? (
                        <>
                          <div className="prose prose-invert prose-sm max-w-none w-full overflow-x-auto
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
                            <Markdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </Markdown>
                          </div>
                          <ResolutionTimeline markdownContent={message.content} messageId={message.id} />
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap font-mono text-[13px]">{message.content}</p>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-3 px-2 flex-wrap gap-y-1">
                       <span className="text-[9px] font-mono text-slate-500 tracking-widest uppercase">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2">
                          {messages[index - 1]?.role === 'user' && (
                            <button 
                              disabled={isSaved}
                              onClick={() => handleSaveToHistory(message, messages[index - 1])}
                              className={cn(
                                "text-[8px] uppercase tracking-[0.15em] flex items-center px-2 py-0.5 rounded transition-all duration-200 font-semibold border",
                                isSaved 
                                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 cursor-default" 
                                  : "bg-transparent text-slate-500 hover:text-cyan-400 border-slate-700 hover:border-cyan-500/30"
                              )}
                            >
                              {isSaved ? <Check size={10} className="mr-1.5" /> : <Bookmark size={10} className="mr-1.5" />}
                              {isSaved ? "SOP_INDEXED" : "GENERATE_SOP"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportTurn(message, messages[index - 1])}
                            disabled={isExporting}
                            className="text-[8px] uppercase tracking-[0.15em] flex items-center px-2 py-0.5 rounded transition-all duration-200 font-semibold border bg-transparent text-slate-500 hover:text-cyan-400 border-slate-700 hover:border-cyan-500/30 disabled:opacity-40"
                            title="Export this specific incident analysis turn as a formatted PDF report"
                          >
                            <FileDown size={10} className="mr-1.5 text-cyan-400" />
                            EXPORT_PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ willChange: "opacity" }} className="flex justify-start">
              <div className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded flex items-center justify-center shrink-0 bg-[#02040a] border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] mt-1">
                  <Bot size={16} />
                </div>
                <div className="glass-card rounded-xl px-6 py-5 flex flex-col space-y-3 min-w-[200px]">
                  <div className="flex items-center space-x-2">
                    <Loader2 size={12} className="animate-spin text-cyan-400" />
                    <span className="text-[10px] font-mono font-medium text-cyan-400 tracking-widest uppercase">Agent Swarm Active</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1 w-full bg-slate-800 rounded overflow-hidden">
                      <motion.div 
                        className="h-full bg-cyan-500 origin-left" 
                        initial={{ scaleX: 0 }} 
                        animate={{ scaleX: 1 }} 
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} 
                        style={{ willChange: "transform" }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase tracking-widest">
                      <span className="text-cyan-500/80">{loadingText}</span>
                      <span className="text-amber-500/50">Processing...</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 md:px-8 shrink-0 border-t border-white/5 z-20 relative bg-[#02040a]/80 backdrop-blur-md">
        <div className="w-full px-4 md:px-8 mx-auto">
          {messages.length < 3 && !input && attachments.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <button onClick={() => handleQuickAction("CRITICAL OPERATION RISK: Production stoppage imminent. PP staging failed because EWM WT was not created. A massive inbound queue block propagates backward. Command the AI to run multi-dimensional root cause analysis, build a decision tree, evaluate relevant SAP OSS Notes for EWM-PP integrations, and generate an enterprise recovery playbook.")}
                className="text-[10px] font-mono tracking-widest bg-gradient-to-br from-[#0f172a]/80 to-[#02040a]/80 hover:from-rose-500/10 hover:to-[#0f172a]/80 text-slate-300 py-3 px-4 rounded-xl border border-white/5 hover:border-rose-500/30 transition-all duration-300 flex items-start gap-3 group backdrop-blur-xl shadow-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-2 mt-1 bg-rose-500 rounded-full group-hover:shadow-[0_0_12px_#f43f5e] group-hover:animate-pulse shrink-0"></div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-rose-400 font-bold mb-1 group-hover:text-rose-300">PP-EWM Anomaly</span>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-400 line-clamp-2">Execute deep root cause analysis & deploy recovery playbook.</span>
                </div>
              </button>
              <button onClick={() => handleQuickAction("SYNAPTIC FAILURE: Freight Order status is failing to replicate from TM to EWM. Execute deep operational reasoning across integration boundaries, predict shipment SLA impact, and generate safest workaround vs permanent fix.")}
                className="text-[10px] font-mono tracking-widest bg-gradient-to-br from-[#0f172a]/80 to-[#02040a]/80 hover:from-amber-500/10 hover:to-[#0f172a]/80 text-slate-300 py-3 px-4 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all duration-300 flex items-start gap-3 group backdrop-blur-xl shadow-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-2 mt-1 bg-amber-500 rounded-full group-hover:shadow-[0_0_12px_#f59e0b] group-hover:animate-pulse shrink-0"></div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-amber-400 font-bold mb-1 group-hover:text-amber-300">TM-EWM Edge Synapse</span>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-400 line-clamp-2">Autonomous route simulation & SLA impact prediction.</span>
                </div>
              </button>
              <button onClick={() => handleQuickAction("THREAT VECTOR DETECTED: SMQ2 queue blocked with SYSFAIL 'Material 10005234 does not exist'. Assess blast radius, correlate cross-module impact, and command Autonomous Agent Swarm to self-heal.")}
                 className="text-[10px] font-mono tracking-widest bg-gradient-to-br from-[#0f172a]/80 to-[#02040a]/80 hover:from-purple-500/10 hover:to-[#0f172a]/80 text-slate-300 py-3 px-4 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all duration-300 flex items-start gap-3 group backdrop-blur-xl shadow-lg relative overflow-hidden"
              >
                 <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-2 h-2 mt-1 bg-purple-500 rounded-full group-hover:shadow-[0_0_12px_#a855f7] group-hover:animate-pulse shrink-0"></div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-purple-400 font-bold mb-1 group-hover:text-purple-300">MM SYSFAIL Auto-Heal</span>
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-400 line-clamp-2">Self-learn material resolution & deploy swarm fix.</span>
                </div>
              </button>
            </div>
          )}

          <form 
            onSubmit={handleSubmit} 
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="relative rounded-2xl bg-[#0a0f1c]/90 focus-within:bg-[#02040a] transition-all duration-500 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_40px_rgba(6,182,212,0.15)] group backdrop-blur-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-cyan-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <AnimatePresence>
              {attachments && attachments.length > 0 && (
                <motion.div 
                  key="attachments"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ willChange: "height, opacity", overflow: "hidden" }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-4 border-b border-white/5 bg-black/20"
                >
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((attachment: any) => (
                      <div key={attachment.id} className="relative group">
                        <div className="border border-slate-700 rounded overflow-hidden bg-black p-0.5">
                          {attachment.type.startsWith('image/') ? (
                            <img src={attachment.data} alt={attachment.name} className="h-12 w-12 object-cover rounded-sm opacity-80" />
                          ) : (
                            <div className="h-12 w-12 flex items-center justify-center bg-slate-900 rounded-sm">
                              <Paperclip size={20} className="text-slate-500" />
                            </div>
                          )}
                          <button type="button" onClick={() => removeAttachment(attachment.id)} className="absolute -top-1.5 -right-1.5 bg-slate-800 text-slate-300 rounded-full p-1 hover:bg-rose-500 hover:text-white transition-colors border border-white/10 shadow-lg">
                            <X size={10} />
                          </button>
                        </div>
                        <div className="mt-1 max-w-[60px] truncate text-[8px] font-mono text-slate-500 text-center uppercase tracking-tighter">
                          {attachment.name}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col justify-center ml-2">
                      <div className="flex items-center text-[10px] font-mono text-cyan-400 mb-0.5 tracking-widest">
                         <FileImage size={10} className="mr-1.5" /> NEURAL_VISION_PAYLOAD_LOADED ({attachments.length})
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Awaiting Command Initiation...</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {isListening && (
                <motion.div
                  key="isListening"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ willChange: "height, opacity", overflow: "hidden" }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-[11px] font-mono"
                >
                  <div className="flex items-center text-rose-400 gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <span className="font-bold tracking-widest uppercase">VOICE_TRANSMISSION_PROTOCOL_ACTIVE...</span>
                  </div>
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider animate-pulse">SPEAK_NOW_TO_TRANSCRIBE_DIRECTLY</span>
                </motion.div>
              )}

              {speechError && (
                <motion.div
                  key="speechError"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ willChange: "height, opacity", overflow: "hidden" }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] font-mono"
                >
                  <div className="flex items-center text-amber-400 gap-2">
                    <ShieldAlert size={12} className="text-amber-500" />
                    <span className="font-bold tracking-widest uppercase">{speechError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpeechError(null)}
                    className="text-slate-400 hover:text-amber-400 text-[9px] uppercase tracking-wider underline cursor-pointer"
                  >
                    DISMISS
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex items-end px-3 py-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors shrink-0">
                <Paperclip size={16} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*,application/pdf" multiple />
              
              <textarea
                value={input} 
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Initialize quantum command sequence, invoke Agentic swarm, or transmit operational telemetry..."
                className="flex-1 max-h-32 min-h-[40px] bg-transparent border-0 focus:ring-0 resize-none py-2 px-3 text-cyan-100 placeholder:text-slate-600 placeholder:font-mono text-[13px] outline-none scrollbar-thin scrollbar-thumb-slate-700 leading-relaxed font-mono"
                rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
              />
              
              <button 
                type="button" 
                onClick={toggleListening}
                className={cn(
                  "p-2 mb-1 mr-1 transition-all duration-300 rounded shrink-0 relative flex items-center justify-center",
                  isListening 
                    ? "text-rose-400 bg-rose-500/15 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse" 
                    : "text-slate-500 hover:text-cyan-400 bg-transparent hover:bg-white/5 border border-transparent"
                )}
                title={isListening ? "Stop Voice Transcription" : "Start Voice Transcription"}
              >
                {isListening ? <MicOff size={16} className="text-rose-400" /> : <Mic size={16} />}
              </button>
              
              <button
                type="submit" disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className="p-2 m-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/40 disabled:opacity-30 disabled:bg-transparent disabled:text-slate-600 disabled:border-transparent rounded transition-all flex items-center justify-center shrink-0"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
          <div className="text-center mt-3">
            <span className="text-[9px] text-slate-600 font-mono tracking-[0.2em] uppercase">Powered by Neural Nexus 2100 • SAP OSS Intelligence Layer Active • Omnipresent Enterprise Brain</span>
          </div>
        </div>
      </div>

      {/* PDF Export Configuration Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#0a0f1d] border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] overflow-hidden font-mono text-slate-300"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#0f172a] border-b border-white/10 flex items-center justify-between relative">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <FileDown size={18} />
                  </div>
                  <div>
                    <h2 className="text-xs font-display font-bold text-white tracking-widest uppercase">
                      EXPORT CHAT ANALYSIS // ENTERPRISE PDF
                    </h2>
                    <p className="text-[9px] text-cyan-400/80 tracking-wider">
                      FORMATTED A4 AUDIT SPECIFICATION REPORT // jsPDF ENGINE
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 text-[11px]">
                {/* Scope selector */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    1. REPORT SCOPE
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModalScope('all')}
                      className={cn(
                        "p-3 rounded-xl border text-left flex flex-col transition-all",
                        modalScope === 'all'
                          ? "bg-cyan-500/10 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      )}
                    >
                      <span className="font-bold text-[10px] text-cyan-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        Full Session
                        {modalScope === 'all' && <Check size={12} className="text-cyan-400" />}
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans leading-tight">
                        Complete chronological transcript ({(messages || []).length} thread exchanges)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalScope('latest')}
                      className={cn(
                        "p-3 rounded-xl border text-left flex flex-col transition-all",
                        modalScope === 'latest'
                          ? "bg-cyan-500/10 border-cyan-500/50 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      )}
                    >
                      <span className="font-bold text-[10px] text-cyan-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                        Latest Incident
                        {modalScope === 'latest' && <Check size={12} className="text-cyan-400" />}
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans leading-tight">
                        Focused 1-turn root cause analysis & remediation playbook
                      </span>
                    </button>
                  </div>
                </div>

                {/* Report Title */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    2. DOCUMENT TITLE
                  </label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="e.g. SAP EWM-TM INTEGRATION QUEUE OUTAGE ANALYSIS"
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Lead Analyst */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    3. LEAD ARCHITECT / ANALYST
                  </label>
                  <input
                    type="text"
                    value={modalAnalyst}
                    onChange={(e) => setModalAnalyst(e.target.value)}
                    placeholder="Lead SCM Solutions Architect"
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <label 
                    onClick={() => setIncludeSignatures(!includeSignatures)}
                    className="flex items-center gap-2 cursor-pointer text-[10px] select-none text-slate-300 hover:text-white transition-colors"
                  >
                    {includeSignatures ? (
                      <CheckSquare size={14} className="text-cyan-400" />
                    ) : (
                      <Square size={14} className="text-slate-500" />
                    )}
                    <span>Include Architectural Governance Sign-off Block</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                    <span>A4 Standard</span>
                    <span>•</span>
                    <span>jsPDF v4</span>
                  </div>
                </div>

                {/* Summary Metadata Strip */}
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Target Modules:</span>
                    <span className="text-cyan-400 font-bold">{sessionModules.join(' + ')}</span>
                  </div>
                  <div className="text-slate-500">
                    Auto-formatted tables, code blocks & timeline
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-[#0f172a] border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteExport}
                  disabled={isExporting}
                  className="px-5 py-2 text-[10px] font-mono uppercase tracking-widest font-bold rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  {isExporting ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : <Download size={13} />}
                  <span>{isExporting ? "GENERATING..." : "DOWNLOAD PDF"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
