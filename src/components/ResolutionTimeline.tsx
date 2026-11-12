import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Clock, PlayCircle, Settings, ChevronDown, ChevronUp, Zap, HelpCircle } from 'lucide-react';
import { parseResolutionSteps, ParsedStep } from '../utils/resolutionParser';

interface ResolutionTimelineProps {
  markdownContent: string;
  messageId: string;
}

export function ResolutionTimeline({ markdownContent, messageId }: ResolutionTimelineProps) {
  const [steps, setSteps] = useState<ParsedStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const parsed = parseResolutionSteps(markdownContent);
    setSteps(parsed);

    // Initialize first step as open and others closed
    if (parsed.length > 0) {
      setExpandedSteps({ [parsed[0].id]: true });
    }
  }, [markdownContent]);

  // Load persistence for checked steps per message if desired, or just use local state
  useEffect(() => {
    const saved = localStorage.getItem(`nexus_resolution_steps_${messageId}`);
    if (saved) {
      try {
        setCompletedSteps(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved step states", e);
      }
    }
  }, [messageId]);

  const toggleStep = (stepId: string) => {
    const updated = {
      ...completedSteps,
      [stepId]: !completedSteps[stepId],
    };
    setCompletedSteps(updated);
    localStorage.setItem(`nexus_resolution_steps_${messageId}`, JSON.stringify(updated));
  };

  const toggleExpand = (stepId: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  if (steps.length === 0) {
    return null;
  }

  const completedCount = steps.filter(s => completedSteps[s.id]).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Determine current active step index (first uncompleted step)
  const firstUncompletedIndex = steps.findIndex(s => !completedSteps[s.id]);

  return (
    <div id={`resolution-timeline-${messageId}`} className="mt-6 border border-cyan-500/20 bg-[#02040a]/70 rounded-xl overflow-hidden font-mono text-[12px] shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-md">
      {/* Timeline Header Banner */}
      <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-black border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse glow-text-cyan"></div>
          <div>
            <h4 className="text-[10px] md:text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
              <Zap size={11} className="text-cyan-400" />
              INTELLIGENT_RESOLUTION_PATH
            </h4>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">
              ACTIVE PLAYBOOK EXECUTION ENGINE // STEP_RESOLVER_V1
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="flex items-center space-x-3 w-full md:w-auto shrink-0 mt-1 md:mt-0">
          <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
            PROGRESS: <span className="text-cyan-400">{progressPercent}%</span>
          </div>
          <div className="w-24 md:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-[9px] text-slate-500">
            ({completedCount}/{steps.length})
          </span>
        </div>
      </div>

      {/* Steps List */}
      <div className="p-4 md:p-6 space-y-6 relative">
        {/* Continuous Connecting Line Background */}
        <div className="absolute left-[27px] md:left-[35px] top-6 bottom-6 w-[2px] bg-slate-800/60 pointer-events-none"></div>

        {steps.map((step, idx) => {
          const isCompleted = !!completedSteps[step.id];
          // An active step is the first uncompleted step
          const isActive = idx === firstUncompletedIndex;
          const isPending = idx > firstUncompletedIndex;
          const isExpanded = !!expandedSteps[step.id];

          // Set colors and badges accordingly
          let statusBadge = "PENDING";
          let badgeColor = "bg-slate-900 border-slate-800 text-slate-500";
          let nodeColor = "border-slate-700 bg-slate-950 text-slate-600";
          let containerBorder = "border-white/5 bg-slate-950/40 hover:bg-slate-950/60";

          if (isCompleted) {
            statusBadge = "RESOLVED";
            badgeColor = "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";
            nodeColor = "border-emerald-500 bg-emerald-950 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
            containerBorder = "border-emerald-500/10 bg-emerald-950/5 hover:bg-emerald-950/10";
          } else if (isActive) {
            statusBadge = "IN_PROGRESS";
            badgeColor = "bg-cyan-500/15 border-cyan-500/30 text-cyan-400 animate-pulse";
            nodeColor = "border-cyan-400 bg-cyan-950/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.4)] ring-2 ring-cyan-500/10";
            containerBorder = "border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-950/20";
          }

          return (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-start gap-4 md:gap-6 relative group"
            >
              {/* Stepper Timeline Circle Column */}
              <div className="relative shrink-0 flex items-center justify-center z-15 mt-1.5">
                {/* Check off clickable checkbox element */}
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className={`w-7 h-7 md:w-9 md:h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${nodeColor} hover:scale-105`}
                  title={isCompleted ? "Mark as in-complete" : "Mark as completed"}
                >
                  {isCompleted ? (
                    <Check size={14} className="stroke-[3]" />
                  ) : isActive ? (
                    <PlayCircle size={14} className="animate-spin duration-3000" />
                  ) : (
                    <span className="text-[10px] font-bold">{step.index}</span>
                  )}
                </button>
              </div>

              {/* Step Card Content Block */}
              <div className={`flex-1 rounded-xl p-4 border transition-all duration-300 ${containerBorder}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Step Title Information */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase border ${badgeColor}`}>
                      {statusBadge}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      STEP_{step.index} // TYPE_{step.type.toUpperCase()}
                    </span>
                  </div>

                  {/* SPRO TCODE badge if applicable */}
                  {step.tcode && (
                    <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider w-fit">
                      T-Code: {step.tcode}
                    </span>
                  )}
                </div>

                <div className="mt-2.5">
                  <h5 className={`font-sans text-[13px] font-semibold leading-snug cursor-pointer flex items-center justify-between gap-2 ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-200'}`} onClick={() => toggleExpand(step.id)}>
                    <span className="hover:text-cyan-300 transition-colors uppercase tracking-wide">{step.title}</span>
                    <button type="button" className="text-slate-500 hover:text-cyan-400 transition-colors p-1" title="Toggle action details">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </h5>
                  
                  {step.description && !isExpanded && (
                    <p className={`mt-1 font-sans text-[11px] text-slate-400 leading-normal line-clamp-1 ${isCompleted ? 'text-slate-500 line-through' : ''}`}>
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Expanded Details containing TCODES, exact instructions */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 pt-3 border-t border-white/5 space-y-2.5 text-[11px] text-slate-300 font-sans leading-relaxed"
                    >
                      {step.description && (
                        <p className={isCompleted ? 'text-slate-500 line-through' : 'text-slate-300'}>
                          {step.description}
                        </p>
                      )}

                      {step.details && step.details.length > 0 && (
                        <div className="bg-[#02040a]/50 p-3 rounded-lg border border-white/5 font-mono text-[10px] space-y-1.5 text-slate-400">
                          {step.details.map((detail, idx2) => (
                            <div key={idx2} className="flex items-start gap-1.5">
                              <span className="text-cyan-500 shrink-0 select-none">›</span>
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Explicit Interactive Check off prompt */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => toggleStep(step.id)}
                          className={`px-3 py-1 rounded text-[9px] font-mono border tracking-wider transition-all cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                          }`}
                        >
                          {isCompleted ? "✔ WORK_UNRESOLVED" : "⚡ ACKNOWLEDGE_COMPLETED"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Completion congratulations */}
      {progressPercent === 100 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 py-4 bg-emerald-500/10 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-400 overflow-hidden relative"
        >
          {/* Subtle neon glowing light bars */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <span className="font-bold uppercase tracking-widest text-[11px] block">ENTERPRISE_THREAT_RECONCILIATION_SUCCESS</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">ALL DISRUPTIVE VECTORS DISPELLED SUCCESSFULLY</span>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded uppercase tracking-widest">
            STATION_ONLINE
          </span>
        </motion.div>
      )}
    </div>
  );
}
