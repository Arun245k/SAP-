import React, { useState, useEffect } from 'react';
import { 
  FileText, Bot, Download, Copy, Share2, Check, Sparkles, 
  Settings, AlertOctagon, RotateCcw, FileSpreadsheet, 
  Bookmark, PlayCircle, Loader2, Database, AlertCircle, RefreshCw, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateSpecifications } from '../services/geminiService';
import { logTelemetry } from '../services/telemetryService';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { generateEnterprisePDF } from '../utils/pdfGenerator';

interface CustomSpec {
  id: string;
  title: string;
  requirement: string;
  docType: 'FSD' | 'TSD' | 'UAT' | 'ALL';
  sapModules: string[];
  author: string;
  version: string;
  criticality: 'Low' | 'Medium' | 'High' | 'Emergency-Stop';
  content: string;
  timestamp: number;
}

const SPEC_TEMPLATES = [
  {
    title: "TM Webhook-Driven Route Re-planner",
    requirement: "Build an automated route re-planner webhook in Transportation Management (TM). The webhook should consume live geographic delay events (e.g., ports blockage, highway disruption alerts) and trigger automated re-routing of assigned Freight Units inside standard TM Freight Orders dynamically, overriding initial SPRO route definitions.",
    modules: ["TM", "SD", "Basis"],
    criticality: "High" as const,
  },
  {
    title: "EWM-PP Staging Failure Microservice Hook",
    requirement: "A real-time microservice trigger that detects physical staging request failures in SCM-EWM during Warehouse Task creation for Production Supply (PP staging errors). If a failing task blocks an order, it must transmit an immediate telemetry packet with high priority to a remote endpoint, flag the SCM cockpit, and auto-evaluate relevant SAP OSS active notes.",
    modules: ["EWM", "PP", "Basis"],
    criticality: "Emergency-Stop" as const,
  },
  {
    title: "Fiori Customs Inbound IDoc Validator Grid",
    requirement: "Design a customizable SAP Fiori dashboard grid to monitor inbound Customs IDocs (SD/MM flows). The grid must cross-examine standard fields from LIPS (Delivery) and VBAK (Sales Order) to automatically validate country-of-origin alignment, detect CIF synchronization blocks, and flag invalid item categories before posting batches.",
    modules: ["SD", "MM", "Basis"],
    criticality: "Medium" as const,
  },
  {
    title: "Outbound Freight Consolidation Engine",
    requirement: "Develop a custom logic block / ABAP BAdI to consolidate outbound deliveries into single TM Freight Orders. The algorithm should combine deliverable items of matching shipping points, carrier routes, and ship-to parties from table VBAK, maximizing vehicular volume utilization and creating direct warehouse pick tasks in EWM.",
    modules: ["EWM", "TM", "MM"],
    criticality: "High" as const,
  }
];

export function DocGeneratorView() {
  const [requirement, setRequirement] = useState('');
  const [docType, setDocType] = useState<'FSD' | 'TSD' | 'UAT' | 'ALL'>('ALL');
  const [selectedModules, setSelectedModules] = useState<string[]>(["EWM", "TM"]);
  const [author, setAuthor] = useState('NEXUS SCM CORE');
  const [version, setVersion] = useState('1.0.0-PROT');
  const [criticality, setCriticality] = useState<'Low' | 'Medium' | 'High' | 'Emergency-Stop'>('High');
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [savedSpecs, setSavedSpecs] = useState<CustomSpec[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentStepText, setCurrentStepText] = useState('Standing by for requirement protocols...');
  const [isSyncing, setIsSyncing] = useState(false);

  const availableModules = ["EWM", "TM", "PP", "SD", "MM", "Basis"];

  // Fetch saved specs from cloud or local storage
  useEffect(() => {
    fetchSpecs();
  }, []);

  const fetchSpecs = async () => {
    setIsSyncing(true);
    setError(null);
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const q = query(collection(db, 'specifications'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
          } as any;
        });
        setSavedSpecs(docs.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err: any) {
        console.error("Firestore spec fetch error:", err);
        // Fallback to local
        loadLocalSpecs();
      } finally {
        setIsSyncing(false);
      }
    } else {
      loadLocalSpecs();
      setIsSyncing(false);
    }
  };

  const loadLocalSpecs = () => {
    try {
      const local = localStorage.getItem('nexus_specs_cache');
      if (local) {
        setSavedSpecs(JSON.parse(local));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleModule = (module: string) => {
    if (selectedModules.includes(module)) {
      setSelectedModules(selectedModules.filter(m => m !== module));
    } else {
      setSelectedModules([...selectedModules, module]);
    }
  };

  const loadTemplate = (tpl: typeof SPEC_TEMPLATES[0]) => {
    setRequirement(tpl.requirement);
    setSelectedModules(tpl.modules);
    setCriticality(tpl.criticality);
    setError(null);
  };

  const handleCopy = () => {
    if (!generatedDoc) return;
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedDoc) return;
    const cleanTitle = requirement.trim().slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `specification_${docType.toLowerCase()}_${cleanTitle || 'doc'}.md`;
    const element = document.createElement("a");
    const file = new Blob([generatedDoc], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportPDF = () => {
    if (!generatedDoc) return;
    try {
      const cleanTitle = requirement.trim().split(/[.!?\n]/)[0].substring(0, 50) || `SCM SPECIFICATION - ${docType}`;
      
      generateEnterprisePDF({
        title: cleanTitle,
        requirement,
        docType,
        sapModules: selectedModules,
        author,
        version,
        criticality,
        content: generatedDoc,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error(err);
      setError("An exception occurred while packaging and exporting to the target enterprise PDF.");
    }
  };

  const handleCompileDoc = async () => {
    if (!requirement.trim()) {
      setError("Please outline product requirements or select an operational template.");
      return;
    }
    if (selectedModules.length === 0) {
      setError("Select at least one active ERP/SAP SCM module to bound architecture scope.");
      return;
    }

    setIsCompiling(true);
    setError(null);
    setGeneratedDoc('');
    setCurrentStepText('Securing secure cognitive channel...');

    const compileSteps = [
      'Establishing secure quantum blueprint routing link...',
      'Mapping SAP standard Master Tables (LIPS, VBAK, /SCWM/ORDIM_C)...',
      'Orchestrating ABAP BAdI enhancements & interface classes...',
      'Synthesizing SPRO configuration paths & warehouse parameters...',
      'Devising diagnostic UAT matrices & error assertion triggers...',
      'Integrating system telemetry & document metadata validation...',
      'Assembling final Enterprise Blueprint Master File...'
    ];

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < compileSteps.length) {
        setCurrentStepText(compileSteps[currentStep]);
        currentStep++;
      }
    }, 1500);

    const startTime = Date.now();
    let docResult = '';
    let isSuccess: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
    try {
      docResult = await generateSpecifications(docType, requirement, {
        sapModules: selectedModules,
        author,
        version,
        criticality,
      });

      clearInterval(stepInterval);
      setGeneratedDoc(docResult);
      
      // Save doc automatically
      await saveSpecToVault(docResult);
    } catch (err: any) {
      isSuccess = 'FAILURE';
      clearInterval(stepInterval);
      setError(err.message || "An exception propagation interrupted compilation.");
    } finally {
      setIsCompiling(false);
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      logTelemetry(
        'Specification Generation',
        requirement.length,
        docResult.length,
        latencyMs,
        isSuccess
      ).catch(e => console.error("Telemetry failed: ", e));
    }
  };

  const saveSpecToVault = async (docContent: string) => {
    const title = requirement.trim().split(/[.!?\n]/)[0].substring(0, 50) + (requirement.length > 50 ? '...' : '');
    const newSpec: Omit<CustomSpec, 'id'> = {
      title: title || `SCM SPECIFICATION - ${docType}`,
      requirement,
      docType,
      sapModules: selectedModules,
      author,
      version,
      criticality,
      content: docContent,
      timestamp: Date.now()
    };

    const currentUser = auth.currentUser;
    if (currentUser) {
      setIsSyncing(true);
      try {
        const specRef = collection(db, 'specifications');
        const docRef = await addDoc(specRef, {
          ...newSpec,
          userId: currentUser.uid,
          createdAt: serverTimestamp()
        });
        
        const finalizedSpec: CustomSpec = {
          id: docRef.id,
          ...newSpec
        };
        
        setSavedSpecs(prev => [finalizedSpec, ...prev]);
        setActiveSpecId(docRef.id);
      } catch (err) {
        console.error("Failed to archive spec to firestore:", err);
        saveSpecLocally(newSpec);
      } finally {
        setIsSyncing(false);
      }
    } else {
      saveSpecLocally(newSpec);
    }
  };

  const saveSpecLocally = (newSpec: Omit<CustomSpec, 'id'>) => {
    const finalizedSpec: CustomSpec = {
      id: `local-${Date.now()}`,
      ...newSpec
    };
    const updated = [finalizedSpec, ...savedSpecs];
    setSavedSpecs(updated);
    setActiveSpecId(finalizedSpec.id);
    localStorage.setItem('nexus_specs_cache', JSON.stringify(updated));
  };

  const selectSavedSpec = (spec: CustomSpec) => {
    setRequirement(spec.requirement);
    setDocType(spec.docType);
    setSelectedModules(spec.sapModules);
    setAuthor(spec.author);
    setVersion(spec.version);
    setCriticality(spec.criticality);
    setGeneratedDoc(spec.content);
    setActiveSpecId(spec.id);
    setError(null);
  };

  const handleDeleteSpec = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear screen if deleting currently viewed spec
    if (activeSpecId === id) {
      setGeneratedDoc('');
      setActiveSpecId(null);
    }

    const currentUser = auth.currentUser;
    if (currentUser && !id.startsWith('local-')) {
      setIsSyncing(true);
      try {
        await deleteDoc(doc(db, 'specifications', id));
        setSavedSpecs(prev => prev.filter(s => s.id !== id));
      } catch (err) {
        console.error("Failed to delete from Firestore:", err);
      } finally {
        setIsSyncing(false);
      }
    } else {
      const updated = savedSpecs.filter(s => s.id !== id);
      setSavedSpecs(updated);
      localStorage.setItem('nexus_specs_cache', JSON.stringify(updated));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#02040a]">
      {/* View Header */}
      <div className="h-16 px-6 md:px-8 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-400/10 animate-pulse"></div>
            <Bookmark className="text-cyan-400" size={16} />
          </div>
          <div>
            <h2 className="text-sm font-display font-medium tracking-widest text-slate-100 uppercase">
              SCM Specification Studio
            </h2>
            <p className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
              FSD / TSD / UAT Engineering & Automated Drafting Matrix
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSyncing && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
              <RefreshCw size={11} className="animate-spin" /> SYNCHRONIZING_CLOUDRUN
            </div>
          )}
          <span className="px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 uppercase tracking-widest">
            Module Release 3.1
          </span>
        </div>
      </div>

      {/* Main Workspace Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Specification Configuration Form (span 5) */}
        <div className="lg:col-span-5 border-r border-white/5 flex flex-col h-full overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-850">
          
          {/* Templates Section */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-mono font-bold mb-3 flex items-center justify-between">
              <span>🚀 Rapid Blueprint Templates</span>
              <span className="text-[8px] font-mono text-slate-500">ONE_CLICK_LOAD</span>
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {SPEC_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => loadTemplate(tpl)}
                  className="text-left p-3 rounded-lg bg-white/5 hover:bg-cyan-500/5 text-[11px] font-mono text-slate-300 border border-white/5 hover:border-cyan-500/20 transition-all group flex items-start gap-2.5"
                >
                  <span className="text-cyan-400 font-bold group-hover:scale-110 transition-transform">⚙️</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors truncate">{tpl.title}</div>
                    <div className="flex gap-1.5 mt-1 shrink-0">
                      {tpl.modules.map(mod => (
                        <span key={mod} className="px-1 text-[8px] border border-white/5 bg-black/40 text-slate-500 rounded">{mod}</span>
                      ))}
                      <span className={`px-1 text-[8px] text-white rounded font-bold uppercase ${
                        tpl.criticality === 'Emergency-Stop' ? 'bg-rose-950/60 border border-rose-800 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tpl.criticality}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Form Requirements Entry */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-2">
                1. Supply Chain Requirements Outline
              </label>
              <textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="Indicate custom logic, business flow, transaction codes, SPRO requirements, tables to combine, custom BAdI trigger points, or general React charts interfaces required..."
                className="w-full text-xs font-mono p-3 bg-[#02040a] border border-white/10 hover:border-white/20 focus:border-cyan-500/40 rounded-lg outline-none resize-none h-40 hover:focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 text-cyan-50 placeholder:text-slate-600 line-height-relaxed"
              />
            </div>

            {/* Document type selection tabs */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-2">
                2. Target Documentation Format
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-black/60 border border-white/5 rounded-lg text-[10px] font-mono">
                {(['FSD', 'TSD', 'UAT', 'ALL'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocType(type)}
                    className={`py-2 rounded-md font-bold uppercase transition-all ${
                      docType === type 
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Modules Checkbox selection */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block mb-2">
                3. Active SCM Module Boundaries
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {availableModules.map(module => {
                  const isChecked = selectedModules.includes(module);
                  return (
                    <button
                      key={module}
                      type="button"
                      onClick={() => toggleModule(module)}
                      className={`py-2 px-3 border rounded-lg text-left font-mono text-[10px] flex items-center justify-between transition-all ${
                        isChecked 
                          ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300' 
                          : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-400 shadow-[0_4px_10px_rgba(0,0,0,0.2)]'
                      }`}
                    >
                      <span>{module}</span>
                      <span className={`w-3 h-3 rounded flex items-center justify-center border text-[8px] font-bold ${
                        isChecked ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300' : 'border-slate-800 bg-black text-transparent'
                      }`}>
                        {isChecked && '✓'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata Fields (Author, Version, Criticality) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                  Author / Role
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full text-[10px] font-mono p-2 bg-black border border-white/5 focus:border-cyan-500/40 text-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                  Revision Ver.
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full text-[10px] font-mono p-2 bg-black border border-white/5 focus:border-cyan-500/40 text-slate-300 rounded"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                  Criticality
                </label>
                <select
                  value={criticality}
                  onChange={(e: any) => setCriticality(e.target.value)}
                  className="w-full text-[10px] font-mono p-2 bg-black border border-white/5 focus:border-cyan-500/40 text-slate-300 rounded outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Emergency-Stop">Emergency-Stop</option>
                </select>
              </div>
            </div>

            {/* Error messaging state */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 font-mono text-[10px] flex items-center space-x-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Compile Actions Button */}
            <button
              type="button"
              onClick={handleCompileDoc}
              disabled={isCompiling}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 hover:border-cyan-500/60 dynamic-glow text-cyan-400 hover:text-cyan-300 transition-all font-mono tracking-widest text-[11px] uppercase flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-40"
            >
              {isCompiling ? (
                <>
                  <Loader2 size={14} className="animate-spin text-cyan-400" />
                  <span>COMPILING SPECIFICATION SWARM CORE...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="dynamic-glow" />
                  <span>DRAFT BLUEPRINT MATRIX SPECIFICATION</span>
                </>
              )}
            </button>
          </div>

          <hr className="border-white/5" />

          {/* Saved specification lists */}
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold mb-3 px-1 flex items-center justify-between">
              <span>🗄️ Spec Core History Vault</span>
              <span className="text-[8px] text-slate-650 bg-black border border-white/5 px-1 rounded">
                {savedSpecs.length} INDEXED
              </span>
            </h3>
            
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-850">
              {savedSpecs.map(spec => (
                <div
                  key={spec.id}
                  onClick={() => selectSavedSpec(spec)}
                  className={`p-3 rounded-lg border text-left flex items-start justify-between cursor-pointer group transition-all duration-200 ${
                    activeSpecId === spec.id 
                      ? 'bg-cyan-500/5 border-cyan-500/30' 
                      : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-mono font-bold text-[11px] text-slate-200 truncate group-hover:text-cyan-400 transition-colors">
                      {spec.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-slate-500 uppercase">
                      <span className="text-cyan-400">{spec.docType}</span>
                      <span>•</span>
                      <span>{new Date(spec.timestamp).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>v{spec.version}</span>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSpec(spec.id, e)}
                    className="p-1 text-slate-600 hover:text-rose-400 rounded transition-colors"
                    title="Delete specification file"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {savedSpecs.length === 0 && (
                <div className="p-4 border border-dashed border-white/5 rounded-lg text-center font-mono text-[10px] text-slate-600">
                  Specification matrix archives empty. Draft a blueprint to synchronize vault.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Document Terminal / Markdown Stream (span 7) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-black/10 overflow-hidden relative">
          
          {/* Document Header Controls */}
          {generatedDoc && (
            <div className="px-6 py-3.5 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  DOCUMENT RENDER EXTRACTION COMPLETE // COMPONENT ARCHITECTURE READY
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 px-3 text-[10px] font-mono text-slate-300 bg-[#0f172a] hover:bg-cyan-500/10 hover:text-cyan-400 border border-white/5 hover:border-cyan-500/25 rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="text-emerald-400" />
                      COPIED!
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      COPY_MD
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1 px-3 text-[10px] font-mono text-slate-300 bg-[#0f172a] hover:bg-purple-500/10 hover:text-purple-400 border border-white/5 hover:border-purple-500/25 rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={11} />
                  DOWNLOAD_MD
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="p-1 px-3 text-[10px] font-mono text-cyan-400 bg-cyan-950/25 hover:bg-cyan-500/15 border border-cyan-500/20 hover:border-cyan-500/40 rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <FileText size={11} className="text-cyan-400 animate-pulse" />
                  EXPORT_PDF
                </button>
              </div>
            </div>
          )}

          {/* Main workspace container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin scrollbar-thumb-slate-850">
            <AnimatePresence mode="wait">
              {isCompiling ? (
                <motion.div
                  key="compiling"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-6"
                >
                  <div className="w-20 h-20 rounded-xl bg-cyan-500/5 border border-cyan-500/25 flex items-center justify-center relative mb-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <div className="absolute inset-0 rounded-xl border border-dashed border-cyan-400/40 animate-spin" style={{ animationDuration: '6s' }}></div>
                    <Bot className="text-cyan-400 animate-pulse" size={40} />
                  </div>
                  
                  <h3 className="text-sm font-display font-bold text-cyan-300 tracking-[0.2em] uppercase mb-2">
                    SCM Documentation Swarm Core Initiated
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest max-w-sm h-6">
                    {currentStepText}
                  </p>
                  
                  {/* Cyber loading line */}
                  <div className="w-56 h-1 rounded-full bg-slate-800 overflow-hidden mt-6 border border-white/5 p-0.5">
                    <div className="h-full bg-cyan-400 rounded-full animate-[loading_20s_infinite_linear]" style={{ width: '82%' }}></div>
                  </div>
                </motion.div>
              ) : generatedDoc ? (
                <motion.div
                  key="doc"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="prose prose-invert prose-sm max-w-none font-mono text-xs text-slate-350 leading-relaxed markdown-body pb-12"
                >
                  <Markdown remarkPlugins={[remarkGfm]}>{generatedDoc}</Markdown>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-xl bg-[#030611]/40"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-slate-500">
                    <FileText size={28} />
                  </div>
                  <h3 className="text-xs font-display font-medium text-slate-400 tracking-[0.2em] uppercase mb-1">
                    READY FOR SPECIFICATION EXTRACTION
                  </h3>
                  <p className="text-[10px] font-mono text-slate-650 max-w-sm uppercase tracking-wider leading-relaxed">
                    Set SCM parameters, customize requirements, and press generate to execute the elite cognitive document architect swarm.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
