import React, { useState, useMemo, useRef } from 'react';
import { 
  Layers, Upload, FileSpreadsheet, AlertTriangle, ShieldAlert, 
  CheckCircle2, RefreshCw, Search, Filter, ArrowUpDown, Bot, 
  Sparkles, Download, Copy, Check, FileText, Play, Database, 
  Clock, X, ChevronRight, Zap, ArrowRight, ExternalLink, SlidersHorizontal,
  ChevronDown, ChevronUp, Wrench, Lightbulb, ListChecks,
  BookOpen, Terminal, HelpCircle, ShieldCheck, CheckSquare, Key, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { analyzeSapIssue } from '../services/geminiService';
import { generateChatSessionPDF } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';

export type QueueSeverity = 'CRITICAL' | 'WARNING' | 'RESOLVED' | 'INFO';

export interface QueueSolution {
  title: string;
  summary: string;
  rootCause: string;
  actionSteps: string[];
  tcodes: string[];
  ossNotes: string[];
  prevention: string;
}

export interface SMQ2QueueItem {
  id: string;
  qname: string;
  entries: number;
  status: 'SYSFAIL' | 'STOP' | 'RETRY' | 'WAITING' | 'RUNNING' | 'ANYSYS';
  client: string;
  user: string;
  fname: string;
  errorText: string;
  timestamp: string;
  destination: string;
  module: 'EWM' | 'TM' | 'CIF' | 'MM/SD' | 'PP' | 'Basis' | 'Other';
  category: 'Lock Conflict' | 'Master Data / Config' | 'RFC / Connectivity' | 'ABAP Dump / DB' | 'Dependency Cascade' | 'Other';
  severity: QueueSeverity;
  severityCode: string;
  solution: QueueSolution;
  aiEnhanced?: boolean;
}

function inferModule(qname: string, fname: string): SMQ2QueueItem['module'] {
  const text = (qname + ' ' + fname).toUpperCase();
  if (text.includes('SCWM') || text.startsWith('WM') || text.includes('EWM')) return 'EWM';
  if (text.includes('TM') || text.includes('SCMTMS') || text.includes('TOR')) return 'TM';
  if (text.includes('CIF') || text.includes('APO')) return 'CIF';
  if (text.includes('DLV') || text.includes('SD') || text.includes('VBAK') || text.includes('LIPS') || text.includes('INB_DELIVERY')) return 'MM/SD';
  if (text.includes('PP') || text.includes('MFG') || text.includes('STAGING')) return 'PP';
  if (text.includes('IDOC') || text.includes('EDI') || text.includes('RFC') || text.includes('SYS')) return 'Basis';
  return 'Other';
}

function inferCategory(errorText: string): SMQ2QueueItem['category'] {
  const text = (errorText || '').toLowerCase();
  if (text.includes('lock') || text.includes('enqueue') || text.includes('locked by user') || text.includes('sm12')) {
    return 'Lock Conflict';
  }
  if (text.includes('preceding') || text.includes('waiting for') || text.includes('cascade') || text.includes('blocked because')) {
    return 'Dependency Cascade';
  }
  if (text.includes('dump') || text.includes('sql') || text.includes('duplicate key') || text.includes('cx_') || text.includes('st22')) {
    return 'ABAP Dump / DB';
  }
  if (text.includes('not reachable') || text.includes('timeout') || text.includes('connection') || text.includes('rfc_error')) {
    return 'RFC / Connectivity';
  }
  if (text.includes('missing') || text.includes('not found') || text.includes('deficit') || text.includes('does not exist') || text.includes('number range') || text.includes('profile')) {
    return 'Master Data / Config';
  }
  return 'Other';
}

export function generateQueueSolution(
  qname: string,
  fname: string,
  status: string,
  errorText: string,
  module: SMQ2QueueItem['module'],
  category: SMQ2QueueItem['category']
): QueueSolution {
  const text = (errorText || '').toLowerCase();
  const fn = (fname || '').toUpperCase();
  const qn = (qname || '').toUpperCase();

  // 1. Lock Conflicts / Enqueue blocks (SM12, /SCWM/PRDO, TM optimizer)
  if (category === 'Lock Conflict' || text.includes('lock') || text.includes('enqueue') || text.includes('locked by user') || text.includes('locked by')) {
    const isEWM = module === 'EWM' || fn.includes('SCWM') || qn.startsWith('WM');
    const isTM = module === 'TM' || fn.includes('TOR') || qn.includes('TM');
    
    return {
      title: 'Release Orphaned Enqueue Table Lock & Reactivate Queue',
      summary: 'Transactional document is locked by a parallel background batch job or disconnected user session.',
      rootCause: `SAP Enqueue Server lock argument conflict detected in table ${isEWM ? '/SCWM/ORDIM_O or /SCDL/DB_PROCH_O' : isTM ? '/SCMTMS/D_TORROT' : 'VBAK / LIKP'}. An active session or batch job holds exclusive edit locks.`,
      actionSteps: [
        `1. Execute transaction SM12 in SAP GUI with Table Name "${isEWM ? '/SCWM/*' : isTM ? '/SCMTMS/*' : '*'}" to inspect active locks.`,
        '2. Check SM37 or SM04 to verify if the locking user or batch process has already finished or disconnected.',
        '3. If the lock is orphaned, select the entry in SM12 and choose "Delete Lock".',
        `4. Open transaction SMQ2, locate queue "${qname}", and execute "Edit -> Activate" (F6).`
      ],
      tcodes: ['SM12', 'SMQ2', isEWM ? '/SCWM/PRDO' : isTM ? '/SCMTMS/TOR' : 'SM04'],
      ossNotes: ['SAP Note 2533877 - qRFC lock handling in Extended Warehouse Management', 'SAP Note 2198089 - Transient enqueue locks in qRFC processing'],
      prevention: 'Stagger high-frequency background batch jobs in SM36 and configure queue retry intervals in SMQS (max retry > 5, delay = 60s).'
    };
  }

  // 2. Missing Warehouse Process Type / Master Data / SPRO configuration
  if (text.includes('warehouse process type') || text.includes('process type missing') || text.includes('/scwm/erpintegration 011') || text.includes('process type')) {
    return {
      title: 'Configure Warehouse Process Type Determination in SPRO',
      summary: 'EWM cannot determine the required Warehouse Process Type (WPT) for delivery item category.',
      rootCause: 'The combination of Warehouse Number, Document Type, Item Type, and Process Type Determination Indicator is missing from customizing table /SCWM/TWPTDET.',
      actionSteps: [
        '1. Open transaction SPRO -> SAP Reference IMG.',
        '2. Navigate to: SCM Extended Warehouse Management -> Cross-Process Settings -> Warehouse Task -> Determine Warehouse Process Type.',
        '3. Add a new entry for your Warehouse Number, Document Category, Item Type, and Process Type Indicator.',
        '4. Alternatively, verify the product master in /SCWM/MAT1 under "Warehouse Data" view to ensure the process type indicator is assigned.',
        `5. Return to SMQ2, select queue "${qname}", and choose "Activate" (F6).`
      ],
      tcodes: ['SPRO', '/SCWM/MAT1', '/SCWM/PRDI', 'SMQ2'],
      ossNotes: ['SAP Note 2212959 - Warehouse Process Type determination logic in S/4HANA EWM', 'SAP Note 1606864 - Missing WPT for inbound delivery items'],
      prevention: 'Enforce master data validation checks during product creation and add fallback default WPT entries in table /SCWM/TWPTDET.'
    };
  }

  // 3. ABAP Short Dump / Open SQL Duplicate Key / CX_SY_*
  if (category === 'ABAP Dump / DB' || text.includes('cx_sy_') || text.includes('short dump') || text.includes('duplicate key') || text.includes('sql')) {
    return {
      title: 'Clear Database Key Collision & Apply Kernel/OSS Patch',
      summary: 'ABAP short dump occurred during transactional write due to duplicate key or runtime database exception.',
      rootCause: 'Open SQL runtime exception (CX_SY_OPEN_SQL_DB or CX_SY_REF_IS_INITIAL) triggered during INSERT/UPDATE on database table. A duplicate GUID or sequence collision occurred.',
      actionSteps: [
        '1. Open transaction ST22 (ABAP Dump Analysis) and filter by the timestamp of the queue failure.',
        '2. Review the "Source Code Extract" and "Contents of System Fields" to identify the offending duplicate key record.',
        '3. If duplicate key exists in database, use consistency report (e.g. /SCMTMS/TOR_MASS_CONSISTENCY or /SCWM/R_CHECK_DATA_BLOCKS).',
        '4. Implement recommended SAP note for function module or reprocess the queue with parameter reset in SMQ2.'
      ],
      tcodes: ['ST22', 'SM21', 'SE16N', 'SMQ2'],
      ossNotes: ['SAP Note 2873412 - CX_SY_OPEN_SQL_DB during mass freight order posting', 'SAP Note 2415177 - Duplicate key exception in inbound delivery buffer'],
      prevention: 'Apply SAP S/4HANA cumulative feature package note corrections for qRFC persistence and ensure number range buffers are not reset.'
    };
  }

  // 4. Preceding Queue Dependency Cascade
  if (category === 'Dependency Cascade' || text.includes('preceding') || text.includes('waiting for queue') || text.includes('cascade') || text.includes('blocked:')) {
    const headQueueMatch = text.match(/(?:queue\s+)([A-Z0-9_-]+)/i);
    const headQueue = headQueueMatch ? headQueueMatch[1] : 'preceding head queue';

    return {
      title: `Resolve Preceding Root Queue "${headQueue}"`,
      summary: 'This queue is strictly waiting on a preceding transactional unit to maintain serialization.',
      rootCause: `qRFC inbound serialization rule prevents out-of-order execution. Queue "${qname}" is blocked solely because parent queue "${headQueue}" failed earlier in status SYSFAIL or STOP.`,
      actionSteps: [
        `1. Locate and resolve the parent queue "${headQueue}" first in transaction SMQ2.`,
        '2. DO NOT delete or force-release this waiting child queue out of order, as doing so may cause partial document inconsistencies.',
        `3. Once the parent queue "${headQueue}" is successfully activated, queue "${qname}" will automatically trigger in sequence.`,
        '4. If queue remains in WAITING status after head queue clears, select it in SMQ2 and press "Unlock" (F5) then "Activate" (F6).'
      ],
      tcodes: ['SMQ2', 'SMQ1', 'SM59'],
      ossNotes: ['SAP Note 1930064 - Queue dependency and serialization in CIF/qRFC', 'SAP Note 2650044 - Automatic recovery of blocked queue cascades'],
      prevention: 'Implement qRFC monitoring alerts (transaction /SAPAPO/CQ) to catch root failures before they cascade to multiple downstream queues.'
    };
  }

  // 5. RFC / Connectivity / Network Timeout (SM59)
  if (category === 'RFC / Connectivity' || text.includes('rfc_error') || text.includes('not reachable') || text.includes('timeout') || text.includes('connection')) {
    return {
      title: 'Restore RFC Gateway Connection & Re-test Destination',
      summary: 'Remote RFC connection to target logical system timed out or was refused by gateway.',
      rootCause: 'Network interruption, gateway buffer saturation, or invalid RFC service user credentials for the RFC destination.',
      actionSteps: [
        '1. Open transaction SM59 -> ABAP Connections -> Select RFC Destination.',
        '2. Click "Connection Test" and "Authorization Test" to verify communication path and credentials.',
        '3. Inspect transaction SMGW (Gateway Monitor) to check for active connections or host connection limits.',
        '4. Check transaction SM21 (System Log) on both sending and receiving systems for corresponding network error codes.',
        '5. Once network connectivity is restored, go to SMQ2, select queue, choose "Edit -> Reset Status", and Activate.'
      ],
      tcodes: ['SM59', 'SMGW', 'SM21', 'SMQ2'],
      ossNotes: ['SAP Note 2499990 - RFC_ERROR_COMMUNICATION timeout troubleshooting', 'SAP Note 375566 - Handling RFC connection failures in qRFC'],
      prevention: 'Increase RFC connection timeout parameter in SM59 and set up dedicated RFC server groups (RZ12) to isolate heavy batch replication traffic.'
    };
  }

  // 6. Deficit Stock / Goods Movement Failure (M7 021)
  if (text.includes('deficit of') || text.includes('m7 021') || text.includes('m7021') || text.includes('sloc stock') || text.includes('stock')) {
    return {
      title: 'Adjust Storage Location Stock Discrepancy & Post Inventory',
      summary: 'Goods issue or movement failed because physical ERP/EWM inventory is lower than requested quantity.',
      rootCause: 'Inventory discrepancy between ERP storage location and EWM bin balance, or parallel posting consumed available stock before this queue arrived.',
      actionSteps: [
        '1. Execute transaction MMBE or /SCWM/MON (Warehouse Monitor) to inspect current unrestricted stock for the material & batch.',
        '2. If stock exists in another storage location, post a transfer posting via transaction MIGO (Movement Type 311).',
        '3. If stock was double-booked by a duplicate goods issue, reverse the duplicate document via MIGO / /SCWM/PRDO.',
        '4. Synchronize ERP and EWM inventory via transaction /SCWM/ERP_STOCKCHECK if necessary.',
        `5. Return to SMQ2, select queue "${qname}", and execute Activate (F6).`
      ],
      tcodes: ['MMBE', '/SCWM/MON', 'MIGO', '/SCWM/PRDO', 'SMQ2'],
      ossNotes: ['SAP Note 1805903 - M7021 deficit during delivery goods issue in EWM', 'SAP Note 2381284 - Inventory synchronization between S/4HANA ERP and EWM'],
      prevention: 'Configure negative stock allowance in SPRO if business allows, or enable strict pre-allocation stock checks in warehouse task creation.'
    };
  }

  // 7. Number Range Exhaustion / Interval Missing
  if (text.includes('number range') || text.includes('exhausted') || text.includes('interval')) {
    return {
      title: 'Extend Number Range Interval Boundaries in SNRO / SPRO',
      summary: 'The sequential number range for this transactional document or staging item has reached its limit.',
      rootCause: 'Number range object interval upper limit was exceeded, or buffering issue caused missing interval number.',
      actionSteps: [
        '1. Open transaction SNRO (Number Range Objects) or use module-specific config in SPRO.',
        '2. Identify the object corresponding to the failed transaction (e.g. /SCWM/PSA, HU_VEKP, INVDELIV).',
        '3. Select "Intervals -> Change" and extend the "To Number" limit without overlapping subsequent intervals.',
        '4. Save changes with a customizing transport if required by client settings.',
        `5. Go to transaction SMQ2, select queue "${qname}", and choose "Activate" (F6).`
      ],
      tcodes: ['SNRO', 'SPRO', 'SMQ2'],
      ossNotes: ['SAP Note 2341092 - Number range maintenance in EWM staging', 'SAP Note 1756548 - Managing buffered number range objects in qRFC'],
      prevention: 'Set up early warning alerts for number ranges reaching 90% capacity using standard report RSNUMHOT.'
    };
  }

  // 8. IDoc Status 51 / Partner Profile Missing (WE20 / BD87)
  if (text.includes('status 51') || text.includes('partner profile') || text.includes('we20') || text.includes('idoc')) {
    return {
      title: 'Maintain EDI/ALE Partner Profile in WE20',
      summary: 'Inbound asynchronous IDoc failed because the sending logical system or message type is not configured.',
      rootCause: 'Missing entry in table EDP21 / EDP13 for partner number, partner type (LS), and logical message type.',
      actionSteps: [
        '1. Open transaction WE20 (Partner Profiles).',
        '2. Expand "Partner Type LS" (Logical System) and select the partner mentioned in the error message.',
        '3. Under "Inbound Parameters", click Create (F5) and add the Message Type (e.g. DESADV, ORDERS, SHPCON).',
        '4. Enter the appropriate Process Code and choose "Trigger Immediately" or "Trigger by background program".',
        '5. Save the partner profile, then reprocess the IDoc via transaction BD87 or activate queue in SMQ2.'
      ],
      tcodes: ['WE20', 'BD87', 'WE02', 'SMQ2'],
      ossNotes: ['SAP Note 2149811 - Partner profile not found in inbound qRFC IDoc', 'SAP Note 1735160 - IDoc processing via inbound qRFC'],
      prevention: 'Maintain complete ALE/IDoc distribution models in transaction BD64 prior to cutting over external EDI interfaces.'
    };
  }

  // Fallback Dynamic Solution
  return {
    title: `Remediate ${module} Functional Queue Failure`,
    summary: `Execute transactional diagnosis for ${fname || 'inbound qRFC unit'} in ${module}.`,
    rootCause: `Operational exception encountered during execution of function module ${fname || qname}: "${errorText.substring(0, 100)}..."`,
    actionSteps: [
      `1. Open transaction SMQ2 in client and double-click queue "${qname}" to inspect all unit parameters.`,
      `2. Verify authorization and parameter payload in function module "${fname}".`,
      '3. Search SAP for the primary error message string in SAP Support Portal or transaction /nOSS.',
      '4. Correct underlying master data or operational document, then execute "Activate" (F6) in SMQ2.'
    ],
    tcodes: ['SMQ2', 'SM21', 'ST22', 'SPRO'],
    ossNotes: ['SAP Note 2200000 - General qRFC inbound error diagnosis and recovery', 'SAP Note 2056636 - Supply chain qRFC troubleshooting guide'],
    prevention: 'Enable automated qRFC monitoring via transaction SMQS and configure automatic error notification dispatch to on-call SAP basis.'
  };
}

// Realistic sample SMQ2 queue error dataset
const SAMPLE_SMQ2_QUEUES: SMQ2QueueItem[] = [
  {
    id: 'smq-001',
    qname: 'WM00000000010482',
    entries: 14,
    status: 'SYSFAIL',
    client: '100',
    user: 'ALEREMOTE',
    fname: '/SCWM/INB_DLV_SAVEREPLICA',
    errorText: '/SCWM/DELIVERY 042: Inbound Delivery 1000452 is locked by user BATCH_EWM_JOB',
    timestamp: '2026-11-05 08:14:22',
    destination: 'NONE',
    module: 'EWM',
    category: 'Lock Conflict',
    severity: 'CRITICAL',
    severityCode: 'ERR-CRIT',
    solution: generateQueueSolution(
      'WM00000000010482',
      '/SCWM/INB_DLV_SAVEREPLICA',
      'SYSFAIL',
      '/SCWM/DELIVERY 042: Inbound Delivery 1000452 is locked by user BATCH_EWM_JOB',
      'EWM',
      'Lock Conflict'
    )
  },
  {
    id: 'smq-002',
    qname: 'WM00000000010483',
    entries: 8,
    status: 'STOP',
    client: '100',
    user: 'RFC_USER',
    fname: '/SCWM/CREATE_WT',
    errorText: '/SCWM/ERPINTEGRATION 011: Warehouse Process Type missing for Item 000010 (Plant 1000, Whse 001)',
    timestamp: '2026-11-05 08:16:05',
    destination: 'NONE',
    module: 'EWM',
    category: 'Master Data / Config',
    severity: 'WARNING',
    severityCode: 'WARN-CFG',
    solution: generateQueueSolution(
      'WM00000000010483',
      '/SCWM/CREATE_WT',
      'STOP',
      '/SCWM/ERPINTEGRATION 011: Warehouse Process Type missing for Item 000010 (Plant 1000, Whse 001)',
      'EWM',
      'Master Data / Config'
    )
  },
  {
    id: 'smq-003',
    qname: 'TM_TOR_0000094120',
    entries: 1,
    status: 'SYSFAIL',
    client: '100',
    user: 'SCHMIDT_M',
    fname: '/SCMTMS/TOR_MASS_POSTING',
    errorText: 'CX_SY_OPEN_SQL_DB: Short dump in /SCMTMS/CL_TOR_POSTING - duplicate key on table /SCMTMS/D_TORROT',
    timestamp: '2026-11-05 08:21:40',
    destination: 'TM_CLNT100',
    module: 'TM',
    category: 'ABAP Dump / DB',
    severity: 'CRITICAL',
    severityCode: 'ERR-DUMP',
    solution: generateQueueSolution(
      'TM_TOR_0000094120',
      '/SCMTMS/TOR_MASS_POSTING',
      'SYSFAIL',
      'CX_SY_OPEN_SQL_DB: Short dump in /SCMTMS/CL_TOR_POSTING - duplicate key on table /SCMTMS/D_TORROT',
      'TM',
      'ABAP Dump / DB'
    )
  },
  {
    id: 'smq-004',
    qname: 'DLV1000004523',
    entries: 26,
    status: 'WAITING',
    client: '100',
    user: 'ALEREMOTE',
    fname: 'BAPI_INB_DELIVERY_CONFIRM',
    errorText: 'Queue blocked: preceding queue WM00000000010482 in status SYSFAIL',
    timestamp: '2026-11-05 08:22:11',
    destination: 'S4HCLNT100',
    module: 'MM/SD',
    category: 'Dependency Cascade',
    severity: 'WARNING',
    severityCode: 'WARN-CASC',
    solution: generateQueueSolution(
      'DLV1000004523',
      'BAPI_INB_DELIVERY_CONFIRM',
      'WAITING',
      'Queue blocked: preceding queue WM00000000010482 in status SYSFAIL',
      'MM/SD',
      'Dependency Cascade'
    )
  },
  {
    id: 'smq-005',
    qname: 'CIF_MAT_000048192',
    entries: 3,
    status: 'SYSFAIL',
    client: '100',
    user: 'CIF_ADMIN',
    fname: '/SAPAPO/CIF_PROD_INB',
    errorText: 'RFC_ERROR_COMMUNICATION: Destination S4HCLNT100 not reachable (timed out after 60s)',
    timestamp: '2026-11-05 08:25:30',
    destination: 'S4HCLNT100',
    module: 'CIF',
    category: 'RFC / Connectivity',
    severity: 'CRITICAL',
    severityCode: 'ERR-COMM',
    solution: generateQueueSolution(
      'CIF_MAT_000048192',
      '/SAPAPO/CIF_PROD_INB',
      'SYSFAIL',
      'RFC_ERROR_COMMUNICATION: Destination S4HCLNT100 not reachable (timed out after 60s)',
      'CIF',
      'RFC / Connectivity'
    )
  },
  {
    id: 'smq-006',
    qname: 'EWM_OUT_00094812',
    entries: 42,
    status: 'SYSFAIL',
    client: '100',
    user: 'OPERATOR_4',
    fname: '/SCWM/OUTB_DLV_POST_GI',
    errorText: 'M7 021: Deficit of SLOC Stock 15 EA for Material MAT-STEEL-440 Batch 00019482 Plant 1000',
    timestamp: '2026-11-05 08:31:02',
    destination: 'NONE',
    module: 'EWM',
    category: 'Master Data / Config',
    severity: 'CRITICAL',
    severityCode: 'ERR-STCK',
    solution: generateQueueSolution(
      'EWM_OUT_00094812',
      '/SCWM/OUTB_DLV_POST_GI',
      'SYSFAIL',
      'M7 021: Deficit of SLOC Stock 15 EA for Material MAT-STEEL-440 Batch 00019482 Plant 1000',
      'EWM',
      'Master Data / Config'
    )
  },
  {
    id: 'smq-007',
    qname: 'PP_STAGE_9041288',
    entries: 5,
    status: 'RETRY',
    client: '100',
    user: 'PP_JOB',
    fname: '/SCWM/MFG_STAGING_REQ',
    errorText: 'Number range 01 for Production Supply Area PSA-LINE-1 exhausted in Warehouse 001',
    timestamp: '2026-11-05 08:34:55',
    destination: 'NONE',
    module: 'PP',
    category: 'Master Data / Config',
    severity: 'WARNING',
    severityCode: 'WARN-CFG',
    solution: generateQueueSolution(
      'PP_STAGE_9041288',
      '/SCWM/MFG_STAGING_REQ',
      'RETRY',
      'Number range 01 for Production Supply Area PSA-LINE-1 exhausted in Warehouse 001',
      'PP',
      'Master Data / Config'
    )
  },
  {
    id: 'smq-008',
    qname: 'IDOC_INB_994102',
    entries: 12,
    status: 'SYSFAIL',
    client: '100',
    user: 'EDI_GATEWAY',
    fname: 'IDOC_INBOUND_ASYNCHRONOUS',
    errorText: 'Status 51: Partner profile not found for partner LS EDI_US port A000000001 message DESADV',
    timestamp: '2026-11-05 08:39:18',
    destination: 'NONE',
    module: 'Basis',
    category: 'Master Data / Config',
    severity: 'CRITICAL',
    severityCode: 'ERR-IDOC',
    solution: generateQueueSolution(
      'IDOC_INB_994102',
      'IDOC_INBOUND_ASYNCHRONOUS',
      'SYSFAIL',
      'Status 51: Partner profile not found for partner LS EDI_US port A000000001 message DESADV',
      'Basis',
      'Master Data / Config'
    )
  },
  {
    id: 'smq-009',
    qname: 'WM00000000010484',
    entries: 19,
    status: 'WAITING',
    client: '100',
    user: 'ALEREMOTE',
    fname: '/SCWM/INB_DLV_SAVEREPLICA',
    errorText: 'Queue waiting for queue WM00000000010482 resolution',
    timestamp: '2026-11-05 08:42:00',
    destination: 'NONE',
    module: 'EWM',
    category: 'Dependency Cascade',
    severity: 'WARNING',
    severityCode: 'WARN-CASC',
    solution: generateQueueSolution(
      'WM00000000010484',
      '/SCWM/INB_DLV_SAVEREPLICA',
      'WAITING',
      'Queue waiting for queue WM00000000010482 resolution',
      'EWM',
      'Dependency Cascade'
    )
  },
  {
    id: 'smq-010',
    qname: 'TM_FU_CREATE_4412',
    entries: 2,
    status: 'RETRY',
    client: '100',
    user: 'TM_PLANNER',
    fname: '/SCMTMS/CL_TOR_GEN=>CREATE_FU',
    errorText: 'Lock conflict: Freight Unit FU-90021 locked by user TM_OPTIMIZER_JOB',
    timestamp: '2026-11-05 08:45:12',
    destination: 'TM_CLNT100',
    module: 'TM',
    category: 'Lock Conflict',
    severity: 'WARNING',
    severityCode: 'WARN-LOCK',
    solution: generateQueueSolution(
      'TM_FU_CREATE_4412',
      '/SCMTMS/CL_TOR_GEN=>CREATE_FU',
      'RETRY',
      'Lock conflict: Freight Unit FU-90021 locked by user TM_OPTIMIZER_JOB',
      'TM',
      'Lock Conflict'
    )
  }
];

function inferSeverity(
  status: string, 
  errorText: string, 
  entries: number, 
  rawSeverity?: string
): { severity: QueueSeverity; severityCode: string } {
  const raw = (rawSeverity || '').trim().toUpperCase();
  const text = (errorText || '').toLowerCase();
  const st = (status || '').toUpperCase();

  // Explicit column in uploaded Excel sheet
  if (['CRITICAL', 'CRIT', 'FATAL', 'HIGH', 'ERROR'].includes(raw) || raw === 'E' || raw === 'X' || raw === 'A') {
    return { 
      severity: 'CRITICAL', 
      severityCode: raw === 'E' ? 'ERR-CRIT' : raw === 'X' ? 'ERR-DUMP' : raw === 'A' ? 'ABORT-SYS' : raw || 'ERR-CRIT' 
    };
  }
  if (['WARN', 'WARNING', 'MEDIUM', 'MID'].includes(raw) || raw === 'W') {
    return { severity: 'WARNING', severityCode: raw === 'W' ? 'WARN-HOLD' : raw || 'WARN' };
  }
  if (['RESOLVED', 'SUCCESS', 'RELEASED', 'OK'].includes(raw) || raw === 'S') {
    return { severity: 'RESOLVED', severityCode: 'RESOLVED' };
  }
  if (['INFO', 'LOW', 'INFORMATION'].includes(raw) || raw === 'I') {
    return { severity: 'INFO', severityCode: 'INFO' };
  }

  // Automatic heuristic classification from SAP error message and status
  if (
    st === 'SYSFAIL' || 
    text.includes('cx_sy_') || 
    text.includes('short dump') || 
    text.includes('rfc_error') || 
    text.includes('not reachable') || 
    text.includes('status 51') || 
    entries >= 25
  ) {
    const code = text.includes('cx_sy_') || text.includes('dump') ? 'ERR-DUMP' :
                 text.includes('rfc_error') || text.includes('reachable') ? 'ERR-COMM' :
                 text.includes('deficit') || text.includes('missing') ? 'ERR-CRIT' :
                 entries >= 25 ? 'ERR-CAP' : 'ERR-SYS';
    return { severity: 'CRITICAL', severityCode: code };
  }

  if (st === 'STOP' || st === 'RETRY' || st === 'WAITING' || text.includes('lock') || text.includes('waiting') || text.includes('exhausted') || text.includes('process type')) {
    const code = text.includes('lock') ? 'WARN-LOCK' :
                 st === 'WAITING' ? 'WARN-CASC' :
                 st === 'RETRY' ? 'WARN-RETRY' : 'WARN-CFG';
    return { severity: 'WARNING', severityCode: code };
  }

  if (st === 'RUNNING') {
    return { severity: 'INFO', severityCode: 'INFO-RUN' };
  }

  return { severity: 'WARNING', severityCode: 'WARN' };
}

export function QueueAnalysisView({ 
  onNavigateToChat, 
  onNavigateToEwmCommunity 
}: { 
  onNavigateToChat?: (prompt: string) => void;
  onNavigateToEwmCommunity?: (query: string) => void;
}) {
  const [queues, setQueues] = useState<SMQ2QueueItem[]>(SAMPLE_SMQ2_QUEUES);
  const [fileName, setFileName] = useState<string>('sample_smq2_inbound_queues.xlsx');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'RESOLVED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'entries' | 'status' | 'qname' | 'time' | 'severity'>('severity');
  const [sortAsc, setSortAsc] = useState(false);
  
  // Inspection, Playbooks & AI Diagnosis Drawer
  const [selectedQueue, setSelectedQueue] = useState<SMQ2QueueItem | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulatedUnlockedQueues, setSimulatedUnlockedQueues] = useState<Set<string>>(new Set());
  
  // Expanded inline playbooks set
  const [expandedPlaybookIds, setExpandedPlaybookIds] = useState<Set<string>>(new Set(['smq-001', 'smq-002']));
  
  // Batch AI Deep-Enhance state
  const [isBatchEnhancing, setIsBatchEnhancing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Dedicated Clearing SOP Guide Modal state
  const [showClearingModal, setShowClearingModal] = useState(false);
  const [clearingModalTab, setClearingModalTab] = useState<'STANDARD' | 'STATUSES' | 'CASCADE' | 'SAFETY_DELETE' | 'BATCH_JOBS'>('STANDARD');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlaybook = (id: string) => {
    setExpandedPlaybookIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedPlaybookIds.size > 0) {
      setExpandedPlaybookIds(new Set());
    } else {
      setExpandedPlaybookIds(new Set(queues.map(q => q.id)));
    }
  };

  // Parse Excel or CSV file with intelligent SAP header detection
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      setFileName(file.name);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Read raw 2D array of rows to locate real table header (handles SAP export title lines)
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) {
        throw new Error('The uploaded Excel sheet contains no readable rows.');
      }

      // Detect header row index
      let headerRowIdx = 0;
      let maxKeywordMatches = 0;
      const headerKeywords = [
        'qname', 'queue', 'warteschlange', 'status', 'zustand', 'einträge', 'entries', 
        'anzahl', 'fname', 'function', 'funktion', 'error', 'fehler', 'text', 'message', 
        'meldung', 'user', 'benutzer', 'uname', 'client', 'mandt', 'dest', 'ziel'
      ];

      for (let r = 0; r < Math.min(20, rawRows.length); r++) {
        const rowStr = (rawRows[r] || []).map(c => String(c || '').toLowerCase()).join(' ');
        let matches = 0;
        for (const kw of headerKeywords) {
          if (rowStr.includes(kw)) matches++;
        }
        if (matches > maxKeywordMatches) {
          maxKeywordMatches = matches;
          headerRowIdx = r;
        }
      }

      const headers = (rawRows[headerRowIdx] || []).map(h => String(h || '').trim());
      const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => r.some((c: any) => String(c || '').trim() !== ''));

      // Format rows as objects
      const rowsToProcess: any[] = dataRows.length > 0
        ? dataRows.map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((h, i) => {
              const key = h || `col_${i}`;
              obj[key] = row[i] !== undefined ? row[i] : '';
            });
            return obj;
          })
        : (XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[]);

      if (!rowsToProcess || rowsToProcess.length === 0) {
        throw new Error('No queue records detected in the uploaded Excel sheet.');
      }

      // Column name mapping heuristics
      const mappedQueues: SMQ2QueueItem[] = rowsToProcess.map((row, idx) => {
        const getVal = (keys: string[]) => {
          for (const key of keys) {
            for (const rowKey of Object.keys(row)) {
              const cleanedRowKey = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanedRowKey === cleanedKey || cleanedRowKey.includes(cleanedKey)) {
                const val = String(row[rowKey]).trim();
                if (val) return val;
              }
            }
          }
          return '';
        };

        const qname = getVal(['qname', 'queuename', 'queue', 'queue_name', 'warteschlange', 'q-name']) || `QUEUE_${idx + 1}`;
        const entriesRaw = getVal(['entries', 'count', 'numberofentries', 'total', 'items', 'einträge', 'anzahl']) || '1';
        const entries = parseInt(entriesRaw, 10) || 1;
        const statusRaw = (getVal(['status', 'queuestatus', 'qstatus', 'state', 'zustand']) || 'SYSFAIL').toUpperCase();
        
        let status: SMQ2QueueItem['status'] = 'SYSFAIL';
        if (statusRaw.includes('STOP')) status = 'STOP';
        else if (statusRaw.includes('RETRY')) status = 'RETRY';
        else if (statusRaw.includes('WAIT')) status = 'WAITING';
        else if (statusRaw.includes('RUN')) status = 'RUNNING';
        else if (statusRaw.includes('SYS')) status = 'SYSFAIL';

        const client = getVal(['client', 'mandt', 'mandant']) || '100';
        const user = getVal(['user', 'uname', 'caller', 'benutzer']) || 'RFC_USER';
        let fname = getVal(['fname', 'functionmodule', 'function', 'program', 'funktionsbaustein', 'fbaustein']);
        if (!fname) {
          // Infer default function module from queue prefix
          if (qname.startsWith('WM')) fname = '/SCWM/INB_DLV_SAVEREPLICA';
          else if (qname.startsWith('TM')) fname = '/SCMTMS/TOR_MASS_POSTING';
          else if (qname.startsWith('CIF')) fname = '/SAPAPO/CIF_PROD_INB';
          else if (qname.startsWith('DLV')) fname = 'BAPI_INB_DELIVERY_CONFIRM';
          else if (qname.startsWith('IDOC')) fname = 'IDOC_INBOUND_ASYNCHRONOUS';
          else fname = 'SAP_QRFC_INB_PROCESSOR';
        }

        let errorText = getVal(['errortext', 'error_text', 'message', 'status_text', 'statustext', 'information', 'text', 'error', 'fehlertext', 'fehler', 'meldung']);
        
        // If errorText column wasn't explicitly matched, look for longest string in row
        if (!errorText || errorText === 'Queue processing error in SMQ2') {
          for (const val of Object.values(row)) {
            const s = String(val).trim();
            if (s.length > 18 && s !== qname && s !== fname && !s.startsWith('20') && !s.includes('@')) {
              errorText = s;
              break;
            }
          }
        }
        if (!errorText) errorText = 'Inbound qRFC processing stopped by system exception';

        const timestamp = getVal(['timestamp', 'datetime', 'date', 'time', 'datum', 'zeit']) || new Date().toISOString().replace('T', ' ').substring(0, 19);
        const destination = getVal(['destination', 'dest', 'target', 'ziel']) || 'NONE';
        const rawSeverity = getVal(['severity', 'severitycode', 'msgtyp', 'msgtype', 'type', 'priority', 'level', 'schweregrad']);

        const module = inferModule(qname, fname);
        const category = inferCategory(errorText);
        const { severity, severityCode } = inferSeverity(status, errorText, entries, rawSeverity);

        // INSTANT AUTOMATED SAP SOLUTION GENERATION FOR THIS QUEUE
        const solution = generateQueueSolution(qname, fname, status, errorText, module, category);

        return {
          id: `queue-${idx}-${Date.now().toString(36)}`,
          qname,
          entries,
          status,
          client,
          user,
          fname,
          errorText,
          timestamp,
          destination,
          module,
          category,
          severity,
          severityCode,
          solution,
          aiEnhanced: false
        };
      });

      setQueues(mappedQueues);
      setSelectedQueue(null);
      setAiDiagnosis(null);
      // Auto-expand top critical queues so solutions are instantly prominent
      const topIds = mappedQueues.slice(0, 3).map(q => q.id);
      setExpandedPlaybookIds(new Set(topIds));
    } catch (err: any) {
      console.error('Failed to parse SMQ2 Excel:', err);
      setUploadError(err?.message || 'Failed to parse Excel sheet. Ensure columns like Queue Name, Status, and Error Text are present.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Batch Live AI Deep-Diagnosis for all loaded queues
  const handleBatchAiEnhance = async () => {
    if (queues.length === 0 || isBatchEnhancing) return;
    try {
      setIsBatchEnhancing(true);
      const updatedQueues = [...queues];

      for (let i = 0; i < updatedQueues.length; i++) {
        setBatchProgress({ current: i + 1, total: updatedQueues.length });
        const q = updatedQueues[i];
        if (q.aiEnhanced) continue;

        try {
          const prompt = `Formulate an emergency SAP remediation playbook for this SMQ2 inbound queue failure:
Queue: ${q.qname} | Module: ${q.module} | Function: ${q.fname} | Error: ${q.errorText}

Respond with exactly these fields:
TITLE: <concise solution title under 8 words>
ROOT_CAUSE: <precise SAP architectural cause in 1 sentence>
STEPS: <step 1 with T-code> | <step 2 with T-code> | <step 3 with T-code> | <step 4 reactivate>
TCODES: <comma-separated list of T-codes e.g. SM12, SMQ2, SPRO>
NOTE: <primary SAP OSS Note number and title>`;

          const response = await analyzeSapIssue(prompt);

          let title = q.solution.title;
          let rootCause = q.solution.rootCause;
          let actionSteps = q.solution.actionSteps;
          let tcodes = q.solution.tcodes;
          let ossNotes = q.solution.ossNotes;

          const lines = response.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('TITLE:')) title = trimmed.replace('TITLE:', '').trim();
            if (trimmed.startsWith('ROOT_CAUSE:')) rootCause = trimmed.replace('ROOT_CAUSE:', '').trim();
            if (trimmed.startsWith('STEPS:')) {
              const rawSteps = trimmed.replace('STEPS:', '').split('|').map(s => s.trim()).filter(Boolean);
              if (rawSteps.length > 0) actionSteps = rawSteps;
            }
            if (trimmed.startsWith('TCODES:')) {
              const tc = trimmed.replace('TCODES:', '').split(',').map(s => s.trim()).filter(Boolean);
              if (tc.length > 0) tcodes = tc;
            }
            if (trimmed.startsWith('NOTE:')) {
              const nt = trimmed.replace('NOTE:', '').trim();
              if (nt) ossNotes = [nt];
            }
          }

          updatedQueues[i] = {
            ...q,
            solution: {
              ...q.solution,
              title,
              rootCause,
              actionSteps,
              tcodes,
              ossNotes
            },
            aiEnhanced: true
          };
          setQueues([...updatedQueues]);
        } catch (err) {
          console.warn(`Live AI enhancement skipped for ${q.qname}:`, err);
        }
      }
    } finally {
      setIsBatchEnhancing(false);
      setBatchProgress(null);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const totalQueues = queues.length;
    const totalBlockedEntries = queues.reduce((acc, q) => acc + q.entries, 0);
    const sysfailCount = queues.filter(q => q.status === 'SYSFAIL').length;
    const stopCount = queues.filter(q => q.status === 'STOP').length;
    const retryCount = queues.filter(q => q.status === 'RETRY').length;
    const waitingCount = queues.filter(q => q.status === 'WAITING').length;

    // Severity counts
    const criticalCount = queues.filter(q => !simulatedUnlockedQueues.has(q.id) && q.severity === 'CRITICAL').length;
    const warningCount = queues.filter(q => !simulatedUnlockedQueues.has(q.id) && q.severity === 'WARNING').length;
    const resolvedCount = queues.filter(q => simulatedUnlockedQueues.has(q.id) || q.severity === 'RESOLVED').length;

    // Categorization counts
    const categories: Record<string, number> = {};
    queues.forEach(q => {
      categories[q.category] = (categories[q.category] || 0) + 1;
    });

    // Modules counts
    const modules: Record<string, number> = {};
    queues.forEach(q => {
      modules[q.module] = (modules[q.module] || 0) + 1;
    });

    const healthScore = totalQueues > 0 
      ? Math.max(10, Math.min(100, Math.round(100 - (criticalCount * 12 + warningCount * 5) + (resolvedCount * 6))))
      : 100;

    return {
      totalQueues,
      totalBlockedEntries,
      sysfailCount,
      stopCount,
      retryCount,
      waitingCount,
      criticalCount,
      warningCount,
      resolvedCount,
      categories,
      modules,
      healthScore
    };
  }, [queues, simulatedUnlockedQueues]);

  // Filtered & Sorted queues
  const filteredQueues = useMemo(() => {
    return queues.filter(q => {
      const isUnlocked = simulatedUnlockedQueues.has(q.id);
      const effectiveSeverity: QueueSeverity = isUnlocked ? 'RESOLVED' : q.severity;

      if (severityFilter !== 'ALL' && effectiveSeverity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      if (moduleFilter !== 'ALL' && q.module !== moduleFilter) return false;
      if (categoryFilter !== 'ALL' && q.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches = q.qname.toLowerCase().includes(query) ||
          q.errorText.toLowerCase().includes(query) ||
          q.fname.toLowerCase().includes(query) ||
          q.user.toLowerCase().includes(query) ||
          (q.severityCode && q.severityCode.toLowerCase().includes(query)) ||
          effectiveSeverity.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    }).sort((a, b) => {
      let diff = 0;
      const isAUnlocked = simulatedUnlockedQueues.has(a.id);
      const isBUnlocked = simulatedUnlockedQueues.has(b.id);
      const sevA = isAUnlocked ? 'RESOLVED' : a.severity;
      const sevB = isBUnlocked ? 'RESOLVED' : b.severity;

      if (sortBy === 'severity') {
        const rank: Record<QueueSeverity, number> = { 'CRITICAL': 3, 'WARNING': 2, 'INFO': 1, 'RESOLVED': 0 };
        diff = rank[sevB] - rank[sevA];
      }
      else if (sortBy === 'entries') diff = b.entries - a.entries;
      else if (sortBy === 'status') diff = a.status.localeCompare(b.status);
      else if (sortBy === 'qname') diff = a.qname.localeCompare(b.qname);
      else if (sortBy === 'time') diff = a.timestamp.localeCompare(b.timestamp);
      return sortAsc ? -diff : diff;
    });
  }, [queues, severityFilter, statusFilter, moduleFilter, categoryFilter, searchQuery, sortBy, sortAsc, simulatedUnlockedQueues]);

  // AI-powered deep diagnosis of selected queue
  const handleDeepDiagnosis = async (queue: SMQ2QueueItem) => {
    try {
      setIsDiagnosing(true);
      setSelectedQueue(queue);
      setAiDiagnosis(null);

      const prompt = `Perform an emergency SMQ2 queue error deep-dive and immediate recovery playbook for this SAP inbound queue failure:
- Queue Name: ${queue.qname}
- Inbound Function Module: ${queue.fname}
- Status: ${queue.status}
- Number of Blocked Entries: ${queue.entries}
- Destination: ${queue.destination} (Client: ${queue.client})
- Executing User: ${queue.user}
- Error Message / Status Text: ${queue.errorText}

Provide:
1. Exact Root Cause analysis in standard SAP S/4HANA / EWM / TM architecture.
2. Step-by-step T-Code remediation instructions (e.g. SM12, /SCWM/PRDO, SMQ2, SPRO config, BD87).
3. Primary SAP OSS Note recommendation with relevance score.
4. Prevention strategy to stop this queue from deadlocking dependent downstream deliveries.`;

      const analysis = await analyzeSapIssue(prompt);
      setAiDiagnosis(analysis);
    } catch (err: any) {
      console.error('Diagnosis failed:', err);
      setAiDiagnosis(`### ⚠️ DIAGNOSIS ENCOUNTERED AN EXCEPTION\n${err?.message || 'Could not connect to cognitive core. Please try again.'}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Simulate Unlock Queue
  const handleSimulateUnlock = (queueId: string) => {
    setSimulatedUnlockedQueues(prev => {
      const next = new Set(prev);
      next.add(queueId);
      return next;
    });
  };

  // Export Queue Audit Report as PDF
  const handleExportQueueAuditPDF = () => {
    const formattedMessages = [
      {
        id: 'user-audit-req',
        role: 'user' as const,
        content: `SAP SMQ2 Inbound Queue Audit & Health Analysis for dataset: "${fileName}". Total Queues Analyzed: ${metrics.totalQueues}, Total Blocked Units: ${metrics.totalBlockedEntries}, Critical SYSFAIL Queues: ${metrics.sysfailCount}.`,
        timestamp: new Date()
      },
      {
        id: 'assistant-audit-resp',
        role: 'assistant' as const,
        content: `### ⚠️ SMQ2 INBOUND QUEUE AUDIT // SYSTEM OPERATIONAL ASSESSMENT
**Dataset Reference**: \`${fileName}\`  
**Overall System Health Score**: **${metrics.healthScore}%** (${metrics.healthScore < 50 ? 'CRITICAL OPERATIONAL RISK' : 'STABILIZED'})  
**Total Queues Evaluated**: ${metrics.totalQueues} queues representing **${metrics.totalBlockedEntries}** blocked transactional units.

#### 📊 QUEUE STATUS CLUSTER SUMMARY
| Queue Status | Count | Operational Impact | Recommended Protocol |
|---|---|---|---|
| **SYSFAIL** | ${metrics.sysfailCount} | Immediate delivery/freight freeze | Check enqueue lock (SM12) & short dump (ST22) |
| **STOP** | ${metrics.stopCount} | Manual or policy queue hold | Validate master data & release via SMQ2 |
| **RETRY** | ${metrics.retryCount} | Temporary resource / lock delay | Monitor automatic RFC retry interval |
| **WAITING** | ${metrics.waitingCount} | Preceding queue dependency cascade | Clear head queue to cascade-release |

#### 🔍 PRIMARY FAILURE VECTORS DETECTED
${Object.entries(metrics.categories).map(([cat, count]) => `- **${cat}**: ${count} affected queue(s)`).join('\n')}

#### 🛠️ QUEUE-BY-QUEUE ROOT CAUSE & IMMEDIATE REMEDIATION PROTOCOLS
${filteredQueues.map((q, i) => `### ${i + 1}. \`${q.qname}\` [${q.status}] (${q.entries} blocked entries)
- **Component / FM**: ${q.module} | \`${q.fname}\` (Client: ${q.client})
- **Status Error**: ${q.errorText}
- **Root Cause**: ${q.solution?.rootCause || 'Under investigation'}
- **Immediate Playbook**:
${(q.solution?.actionSteps || ['Inspect queue in SMQ2 and activate']).map(step => `  * ${step}`).join('\n')}
- **T-Codes**: ${(q.solution?.tcodes || ['SMQ2']).map(tc => `\`${tc}\``).join(', ')}
- **OSS Notes**: ${(q.solution?.ossNotes || ['N/A']).join(', ')}`).join('\n\n')}

#### ⚡ EMERGENCY REMEDIATION ACTION SUMMARY
1. **Lock Cleansing**: Execute transaction \`SM12\` to inspect and safely release stale table locks held by background batch jobs.
2. **Master Data Alignment**: Resolve missing Warehouse Process Types or Customizing entries in \`SPRO\` for impacted plants.
3. **Queue Reprocessing Protocol**: Select \`SYSFAIL\` queues in \`SMQ2\` and execute "Activate (F6)" in FIFO order.`,
        timestamp: new Date()
      }
    ];

    generateChatSessionPDF({
      messages: formattedMessages,
      sessionTitle: `SAP SMQ2 QUEUE AUDIT REPORT - ${fileName.toUpperCase()}`,
      analystName: "Principal SCM Integration Architect",
      systemTag: "#SMQ2-AUDIT-2100",
      includeSignatures: true
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyClearingSOP = () => {
    const sop = `SAP SMQ2 INBOUND QUEUE CLEARING STANDARD OPERATING PROCEDURE (SOP)
========================================================================

PHASE 1: INSPECTION & TRIAGE
1. Execute transaction /nSMQ2 in SAP GUI.
2. In selection screen, enter Client (e.g. 100), Queue Name (e.g. WM* or *), and press F8 (Execute).
3. Identify queues in status SYSFAIL, STOP, RETRY, or WAITING.
4. Double-click the Queue Name to display the list of blocked LUWs (Logical Units of Work).
5. Double-click the "Status" text to read the specific error message and function module.
6. If an ABAP runtime dump is indicated, open /nST22 in a parallel session to examine the exact dump and call stack.

PHASE 2: RESOLVING ROOT CAUSE BEFORE ACTIVATION
- LOCK CONFLICTS:
  1. Open transaction /nSM12.
  2. Set Table Name (/SCWM/*, /SCMTMS/*, VBAK) and User (*).
  3. Verify with /nSM04 or /nSM37 if the locking user/job is inactive.
  4. Select orphaned lock -> Delete Lock Entry (Shift+F2).

- MISSING MASTER DATA / CONFIGURATION:
  1. Maintain missing entries in /nSPRO or master data transactions (/SCWM/MAT1, MM02, WE20).
  2. Save and transport customizing if applicable.

- STOCK SHORTAGES (M7 021):
  1. Check stock in /nMMBE or /n/SCWM/MON.
  2. Post stock transfer via /nMIGO (movement 311) or reverse duplicate movements.

PHASE 3: QUEUE ACTIVATION & REPROCESSING
1. Return to transaction /nSMQ2.
2. Select the queue row.
3. If queue is in STOP or RETRY status, select menu: Edit -> Reset Status (Shift+F5).
4. Press F6 (or choose Edit -> Activate) to process the queue in foreground.
5. If queue contains multiple LUWs, process them in strict FIFO order (top to bottom).
6. Verify that the entry count decrements to 0 and the queue disappears from SMQ2.

PHASE 4: DEBUGGING STUCK LUWS (WHEN ERROR IS UNCLEAR)
1. In SMQ2, drill into the queue to display the LUWs.
2. Select the failing LUW row.
3. Choose menu: Edit -> Debug LUW (or double click -> LUW -> Debug).
4. The ABAP Debugger will automatically launch when the function module executes.
5. Step through (F5/F6) to inspect sy-subrc and internal table payloads.

PHASE 5: SAFE DELETION PROTOCOL (LAST RESORT ONLY)
* CRITICAL WARNING: Never delete delivery or financial queues without business approval.
1. If the business confirms document cancellation or manual re-entry:
   In SMQ2 -> Select LUW -> Choose menu: Edit -> Delete Selected LUW (Shift+F2).
2. Immediately re-trigger the message from the source system (e.g. ERP VL06I / /SCWM/PRDO / BD87).

PHASE 6: AUTOMATED PERIODIC BACKGROUND REPROCESSING
- Schedule program RSQIWKEX in transaction SM36 (hourly) to restart inbound queues.
- Configure transaction SMQR (qRFC Inbound Scheduler) for automatic queue activation.`;
    copyToClipboard(sop, 'clearing-sop');
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-transparent">
      {/* Background radial atmosphere */}
      <div className="absolute top-0 right-0 w-[50vh] h-[50vh] radial-bg pointer-events-none opacity-40 z-0"></div>
      <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-cyan-500/5 rounded-full filter blur-[120px] pointer-events-none z-0"></div>

      {/* Header Bar */}
      <header className="min-h-[4rem] flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 md:px-8 py-3.5 gap-4 border-b border-white/5 shrink-0 z-10 glass-panel relative">
        <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"></div>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Layers size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-display font-bold text-white tracking-widest uppercase">
                SAP SMQ2 INBOUND QUEUE INTELLIGENCE WORKBENCH
              </h1>
              <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                qRFC PARSER ACTIVE
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider">
              SOURCE SHEET: <span className="text-slate-200">{fileName}</span> ({queues.length} QUEUES LOADED)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
          />

          <button
            onClick={() => setShowClearingModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all font-bold"
            title="Open comprehensive SAP SMQ2 queue clearing guide & step-by-step resolution SOP"
          >
            <BookOpen size={12} className="text-cyan-400" />
            <span>CLEARING SOP GUIDE</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
          >
            {isUploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
            <span>{isUploading ? 'PARSING...' : 'UPLOAD SMQ2 SHEET'}</span>
          </button>

          <button
            onClick={handleBatchAiEnhance}
            disabled={isBatchEnhancing || queues.length === 0}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest border transition-all",
              isBatchEnhancing 
                ? "bg-purple-500/25 text-purple-300 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)] animate-pulse" 
                : "bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
            )}
            title="Run AI live deep-diagnosis across all loaded queues"
          >
            {isBatchEnhancing ? <RefreshCw size={12} className="animate-spin text-purple-400" /> : <Bot size={12} className="text-purple-400" />}
            <span>{isBatchEnhancing ? `AI ENHANCING (${batchProgress?.current}/${batchProgress?.total})...` : 'AUTO-SOLVE ALL WITH AI'}</span>
          </button>

          <button
            onClick={toggleExpandAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
            title="Expand or collapse all step-by-step remediation playbooks"
          >
            <ListChecks size={12} className="text-cyan-400" />
            <span>{expandedPlaybookIds.size > 0 ? 'COLLAPSE ALL' : 'EXPAND ALL PLAYBOOKS'}</span>
          </button>

          <button
            onClick={() => {
              setQueues(SAMPLE_SMQ2_QUEUES);
              setFileName('sample_smq2_inbound_queues.xlsx');
              setSelectedQueue(null);
              setAiDiagnosis(null);
              setExpandedPlaybookIds(new Set(['smq-001', 'smq-002']));
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
            title="Load realistic standard SAP SMQ2 queue sample"
          >
            <FileSpreadsheet size={12} className="text-amber-400" />
            <span>LOAD SAMPLE</span>
          </button>

          <button
            onClick={handleExportQueueAuditPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-widest bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all"
            title="Export full queue analysis as formatted enterprise PDF"
          >
            <Download size={12} />
            <span>EXPORT AUDIT PDF</span>
          </button>
        </div>
      </header>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="px-6 py-2.5 bg-rose-950/40 border-b border-rose-500/30 text-rose-300 text-[10px] font-mono flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-rose-400/70 hover:text-rose-300">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
        
        {/* Metric Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-card p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">TOTAL QUEUES</span>
            <div className="text-xl font-display font-bold text-white mt-1">{metrics.totalQueues}</div>
            <span className="text-[8px] font-mono text-cyan-400 mt-1">Inbound qRFCs</span>
          </div>

          <div className="glass-card p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">BLOCKED UNITS</span>
            <div className="text-xl font-display font-bold text-amber-300 mt-1">{metrics.totalBlockedEntries}</div>
            <span className="text-[8px] font-mono text-slate-500 mt-1">Queued Transactions</span>
          </div>

          {/* CRITICAL in Red */}
          <button 
            onClick={() => setSeverityFilter(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
            className={cn(
              "glass-card p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden",
              severityFilter === 'CRITICAL' 
                ? "border-rose-500 bg-rose-950/30 shadow-[0_0_20px_rgba(244,63,94,0.3)] ring-1 ring-rose-500" 
                : "border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50"
            )}
          >
            <div className="absolute top-0 right-0 w-8 h-8 bg-rose-500/15 rounded-bl-full pointer-events-none"></div>
            <span className="text-[9px] font-mono text-rose-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              CRITICAL
            </span>
            <div className="text-xl font-display font-bold text-rose-400 mt-1">{metrics.criticalCount}</div>
            <span className="text-[8px] font-mono text-rose-400/80 mt-1">Severe / SYSFAIL</span>
          </button>

          {/* WARNING in Amber */}
          <button 
            onClick={() => setSeverityFilter(severityFilter === 'WARNING' ? 'ALL' : 'WARNING')}
            className={cn(
              "glass-card p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden",
              severityFilter === 'WARNING' 
                ? "border-amber-500 bg-amber-950/30 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-500" 
                : "border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50"
            )}
          >
            <span className="text-[9px] font-mono text-amber-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              WARNING
            </span>
            <div className="text-xl font-display font-bold text-amber-400 mt-1">{metrics.warningCount}</div>
            <span className="text-[8px] font-mono text-amber-400/80 mt-1">Lock / Config Hold</span>
          </button>

          {/* RESOLVED in Emerald */}
          <button 
            onClick={() => setSeverityFilter(severityFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
            className={cn(
              "glass-card p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden",
              severityFilter === 'RESOLVED' 
                ? "border-emerald-500 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500" 
                : "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
            )}
          >
            <span className="text-[9px] font-mono text-emerald-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-400" />
              RESOLVED
            </span>
            <div className="text-xl font-display font-bold text-emerald-400 mt-1">{metrics.resolvedCount}</div>
            <span className="text-[8px] font-mono text-emerald-400/80 mt-1">Released / Cleared</span>
          </button>

          {/* HEALTH INDEX */}
          <div className="glass-card p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/10 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-cyan-300 uppercase tracking-widest">HEALTH INDEX</span>
            <div className="text-xl font-display font-bold text-cyan-400 mt-1">{metrics.healthScore}%</div>
            <div className="w-full bg-black/40 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  metrics.healthScore > 75 ? "bg-emerald-400" : metrics.healthScore > 40 ? "bg-amber-400" : "bg-rose-500"
                )}
                style={{ width: `${metrics.healthScore}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Root Cause Clusters Overview */}
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" />
              <h3 className="text-[10px] font-display font-bold text-white tracking-widest uppercase">
                AI ROOT CAUSE CLUSTER DISTRIBUTION
              </h3>
            </div>
            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
              AUTOMATIC HEURISTIC CLASSIFIER
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {Object.entries(metrics.categories).map(([category, count]) => {
              const isSelected = categoryFilter === category;
              return (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(isSelected ? 'ALL' : category)}
                  className={cn(
                    "p-2.5 rounded-lg border text-left transition-all",
                    isSelected 
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  )}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="truncate">{category}</span>
                    <span className="text-cyan-400 font-mono ml-1">{count}</span>
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 mt-1">
                    {Math.round((count / metrics.totalQueues) * 100)}% of total queues
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between glass-card p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queue name, error text, user, severity code..."
              className="w-full bg-transparent text-[11px] font-mono text-white placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-wrap">
            {/* Severity Filter Tabs */}
            <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10 shrink-0">
              <button
                onClick={() => setSeverityFilter('ALL')}
                className={cn(
                  "px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all",
                  severityFilter === 'ALL'
                    ? "bg-cyan-500/20 text-cyan-300 font-bold"
                    : "text-slate-400 hover:text-white"
                )}
              >
                ALL
              </button>
              <button
                onClick={() => setSeverityFilter('CRITICAL')}
                className={cn(
                  "px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1",
                  severityFilter === 'CRITICAL'
                    ? "bg-rose-500/25 text-rose-300 font-bold border border-rose-500/40"
                    : "text-rose-400 hover:text-rose-300"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                CRITICAL ({metrics.criticalCount})
              </button>
              <button
                onClick={() => setSeverityFilter('WARNING')}
                className={cn(
                  "px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1",
                  severityFilter === 'WARNING'
                    ? "bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40"
                    : "text-amber-400 hover:text-amber-300"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                WARNING ({metrics.warningCount})
              </button>
              <button
                onClick={() => setSeverityFilter('RESOLVED')}
                className={cn(
                  "px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all flex items-center gap-1",
                  severityFilter === 'RESOLVED'
                    ? "bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40"
                    : "text-emerald-400 hover:text-emerald-300"
                )}
              >
                <CheckCircle2 size={10} />
                RESOLVED ({metrics.resolvedCount})
              </button>
            </div>

            {/* Technical Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/40 border border-white/10 px-2 py-1.5 rounded-lg text-[9px] font-mono text-slate-300 uppercase tracking-wider focus:outline-none focus:border-cyan-500 shrink-0"
            >
              <option value="ALL">All Statuses</option>
              <option value="SYSFAIL">SYSFAIL</option>
              <option value="STOP">STOP</option>
              <option value="RETRY">RETRY</option>
              <option value="WAITING">WAITING</option>
            </select>

            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-black/40 border border-white/10 px-2 py-1.5 rounded-lg text-[9px] font-mono text-slate-300 uppercase tracking-wider focus:outline-none focus:border-cyan-500 shrink-0"
            >
              <option value="ALL">All Modules</option>
              <option value="EWM">EWM</option>
              <option value="TM">TM</option>
              <option value="CIF">CIF</option>
              <option value="MM/SD">MM / SD</option>
              <option value="PP">PP</option>
              <option value="Basis">Basis</option>
            </select>

            {/* Sort Toggle */}
            <button
              onClick={() => {
                if (sortBy === 'severity') setSortBy('entries');
                else if (sortBy === 'entries') setSortBy('status');
                else if (sortBy === 'status') setSortBy('qname');
                else setSortBy('severity');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[9px] font-mono text-slate-300 uppercase hover:text-white shrink-0"
            >
              <ArrowUpDown size={11} />
              <span>SORT: {sortBy.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Queues Table Grid */}
        <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[10px]">
              <thead className="bg-[#0f172a]/90 text-slate-400 uppercase tracking-widest text-[8.5px] border-b border-white/10">
                <tr>
                  <th className="py-3 px-3">Queue Name & Client</th>
                  <th className="py-3 px-3">Status & Severity</th>
                  <th className="py-3 px-2 text-center">Entries</th>
                  <th className="py-3 px-2">Module</th>
                  <th className="py-3 px-3 max-w-[200px]">Error & Function</th>
                  <th className="py-3 px-4 min-w-[320px]">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                      <Zap size={12} className="text-amber-400" />
                      <span>SAP Root Cause & Immediate Solution</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredQueues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                      No matching SMQ2 queues found. Adjust your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredQueues.map((queue) => {
                    const isUnlocked = simulatedUnlockedQueues.has(queue.id);
                    const isSelected = selectedQueue?.id === queue.id;
                    const effectiveSeverity: QueueSeverity = isUnlocked ? 'RESOLVED' : queue.severity;
                    const isPlaybookExpanded = expandedPlaybookIds.has(queue.id);

                    return (
                      <React.Fragment key={queue.id}>
                        <tr 
                          className={cn(
                            "transition-colors hover:bg-white/[0.03] group",
                            isSelected && "bg-cyan-500/[0.08] border-l-2 border-l-cyan-400",
                            isPlaybookExpanded && "bg-cyan-950/20"
                          )}
                        >
                          {/* Queue Name */}
                          <td className="py-3 px-3 font-bold text-white whitespace-nowrap align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono tracking-tight">{queue.qname}</span>
                              <button 
                                onClick={() => copyToClipboard(queue.qname, queue.id)}
                                className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy Queue Name"
                              >
                                {copiedId === queue.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            </div>
                            <div className="text-[8px] text-slate-500 font-normal mt-0.5">
                              Clnt: {queue.client} • Dest: {queue.destination}
                            </div>
                          </td>

                          {/* Status & Severity Color-Coded Badges */}
                          <td className="py-3 px-3 whitespace-nowrap align-top">
                            <div className="flex flex-col gap-1 items-start">
                              {effectiveSeverity === 'CRITICAL' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-bold font-mono tracking-wider bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                  CRITICAL
                                  <span className="text-[7.5px] font-normal px-1 py-0.5 bg-rose-950/70 text-rose-300 rounded border border-rose-500/30">
                                    {queue.severityCode}
                                  </span>
                                </span>
                              )}

                              {effectiveSeverity === 'WARNING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-bold font-mono tracking-wider bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  WARNING
                                  <span className="text-[7.5px] font-normal px-1 py-0.5 bg-amber-950/70 text-amber-300 rounded border border-amber-500/30">
                                    {queue.severityCode}
                                  </span>
                                </span>
                              )}

                              {effectiveSeverity === 'RESOLVED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-bold font-mono tracking-wider bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                                  <CheckCircle2 size={10} className="text-emerald-400" />
                                  RESOLVED
                                  <span className="text-[7.5px] font-normal px-1 py-0.5 bg-emerald-950/70 text-emerald-300 rounded border border-emerald-500/30">
                                    RELEASED
                                  </span>
                                </span>
                              )}

                              {effectiveSeverity === 'INFO' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-bold font-mono tracking-wider bg-cyan-500/15 text-cyan-400 border-cyan-500/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                  INFO
                                </span>
                              )}

                              {/* Technical qRFC State */}
                              <span className="text-[8px] font-mono text-slate-500 flex items-center gap-1 pl-0.5">
                                <span>qRFC:</span>
                                <span className={cn(
                                  "font-semibold",
                                  isUnlocked ? "text-emerald-400" :
                                  queue.status === 'SYSFAIL' ? "text-rose-400" :
                                  queue.status === 'STOP' ? "text-amber-400" :
                                  queue.status === 'RETRY' ? "text-blue-400" :
                                  queue.status === 'WAITING' ? "text-purple-400" :
                                  "text-slate-400"
                                )}>
                                  {isUnlocked ? 'RELEASED' : queue.status}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* Entries */}
                          <td className="py-3 px-2 text-center whitespace-nowrap align-top">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded font-bold text-[9px] font-mono",
                              queue.entries > 20 ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                              queue.entries > 5 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                              "bg-white/5 text-slate-300 border border-white/5"
                            )}>
                              {queue.entries}
                            </span>
                          </td>

                          {/* Module */}
                          <td className="py-3 px-2 whitespace-nowrap align-top">
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[8.5px] font-mono">
                              {queue.module}
                            </span>
                          </td>

                          {/* Error & Function Details */}
                          <td className="py-3 px-3 max-w-[220px] align-top">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] font-mono text-slate-500 truncate" title={queue.fname}>
                                FM: <span className="text-slate-300">{queue.fname}</span>
                              </span>
                              <p className="text-[9.5px] text-rose-300/90 leading-tight font-mono line-clamp-2" title={queue.errorText}>
                                {queue.errorText}
                              </p>
                              <span className="text-[7.5px] font-mono text-slate-500">
                                Category: <span className="text-slate-400">{queue.category}</span>
                              </span>
                            </div>
                          </td>

                          {/* DEDICATED SOLUTION & REMEDIATION PLAYBOOK COLUMN */}
                          <td className="py-3 px-4 min-w-[320px] align-top">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-cyan-300 text-[10px] flex items-center gap-1">
                                  <Lightbulb size={11} className="text-amber-400 shrink-0" />
                                  {queue.solution.title}
                                </span>
                                {queue.aiEnhanced && (
                                  <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[7px] font-mono uppercase tracking-wider">
                                    AI LIVE
                                  </span>
                                )}
                              </div>

                              {/* Action T-Codes badges */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[7.5px] uppercase font-mono text-slate-500">T-CODES:</span>
                                {queue.solution.tcodes.map(tc => (
                                  <span key={tc} className="px-1.5 py-0.2 rounded bg-white/10 text-cyan-300 border border-white/15 text-[8px] font-mono font-bold">
                                    {tc}
                                  </span>
                                ))}
                              </div>

                              {/* 1-Line Solution Summary */}
                              <p className="text-[9.5px] text-slate-300 leading-snug font-sans">
                                {queue.solution.summary}
                              </p>

                              {/* Toggle Button for Full Playbook */}
                              <div className="flex items-center gap-3 pt-0.5">
                                <button
                                  onClick={() => togglePlaybook(queue.id)}
                                  className="text-[8.5px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 w-max font-bold hover:underline"
                                >
                                  {isPlaybookExpanded ? (
                                    <>
                                      <ChevronUp size={11} />
                                      <span>HIDE PLAYBOOK</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={11} />
                                      <span>VIEW 4-STEP SAP PLAYBOOK</span>
                                    </>
                                  )}
                                </button>
                                {queue.solution.ossNotes.length > 0 && (
                                  <span className="text-[7.5px] text-amber-400/80 font-mono">
                                    {queue.solution.ossNotes[0].split(' - ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right whitespace-nowrap align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDeepDiagnosis(queue)}
                                className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 text-[8.5px] uppercase tracking-wider transition-all"
                                title="Run AI deep-dive on this queue"
                              >
                                <Bot size={11} className="text-cyan-400" />
                                <span>DIAGNOSE</span>
                              </button>

                              {!isUnlocked && (
                                <button
                                  onClick={() => handleSimulateUnlock(queue.id)}
                                  className="px-2 py-1 rounded bg-white/5 hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 text-[8.5px] uppercase tracking-wider transition-all flex items-center gap-1"
                                  title="Simulate Queue Reprocess & Release in SMQ2"
                                >
                                  <Play size={10} />
                                  <span className="hidden sm:inline">RELEASE</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDABLE COMPLETE SAP REMEDIATION PLAYBOOK ROW */}
                        {isPlaybookExpanded && (
                          <tr className="bg-black/60 border-y border-cyan-500/30">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="rounded-xl bg-gradient-to-br from-cyan-950/20 to-black/80 border border-cyan-500/30 p-4 space-y-3.5 shadow-[inset_0_0_20px_rgba(6,182,212,0.06)]">
                                
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-[10px]">
                                      <Wrench size={12} />
                                    </div>
                                    <span className="text-[11px] font-display font-bold text-white uppercase tracking-wider">
                                      REMEDIATION PLAYBOOK: {queue.qname}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const text = `SAP SMQ2 REMEDIATION PLAN for Queue: ${queue.qname}\nError: ${queue.errorText}\n\nROOT CAUSE:\n${queue.solution.rootCause}\n\nACTION STEPS:\n${queue.solution.actionSteps.join('\n')}\n\nT-CODES: ${queue.solution.tcodes.join(', ')}\nOSS NOTES: ${queue.solution.ossNotes.join(', ')}\nPREVENTION:\n${queue.solution.prevention}`;
                                        copyToClipboard(text, `sol-${queue.id}`);
                                      }}
                                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[8.5px] font-mono uppercase flex items-center gap-1 border border-white/10 transition-all"
                                    >
                                      {copiedId === `sol-${queue.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                      <span>COPY FULL PLAN</span>
                                    </button>

                                    {!isUnlocked && (
                                      <button
                                        onClick={() => handleSimulateUnlock(queue.id)}
                                        className="px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[8.5px] font-mono uppercase flex items-center gap-1 border border-emerald-500/30 transition-all"
                                      >
                                        <Play size={10} />
                                        <span>EXECUTE & RELEASE QUEUE</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-[10px]">
                                  {/* Left: Root Cause & Action Steps */}
                                  <div className="space-y-3">
                                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                                      <div className="text-[8.5px] uppercase font-mono text-cyan-400 font-bold mb-1 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                        ARCHITECTURAL ROOT CAUSE
                                      </div>
                                      <p className="text-slate-300 text-[9.5px] leading-relaxed">
                                        {queue.solution.rootCause}
                                      </p>
                                    </div>

                                    <div>
                                      <div className="text-[8.5px] uppercase font-mono text-amber-300 font-bold mb-1.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                        STEP-BY-STEP SAP EXECUTION PROTOCOL
                                      </div>
                                      <div className="space-y-1.5">
                                        {queue.solution.actionSteps.map((step, sIdx) => (
                                          <div key={sIdx} className="p-2 rounded bg-black/40 border border-white/5 text-[9.5px] text-slate-200 leading-snug flex items-start gap-2">
                                            <span className="font-mono text-cyan-400 font-bold">{sIdx + 1}.</span>
                                            <span>{step}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: T-Codes, OSS Notes & Prevention */}
                                  <div className="space-y-3">
                                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                                      <div className="text-[8.5px] uppercase font-mono text-purple-300 font-bold mb-1.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                        PRIMARY SAP OSS NOTES & REFERENCES
                                      </div>
                                      <ul className="space-y-1">
                                        {queue.solution.ossNotes.map((note, nIdx) => (
                                          <li key={nIdx} className="text-cyan-300 hover:text-cyan-200 text-[9px] font-mono flex items-center gap-1.5">
                                            <span className="w-1 h-1 bg-cyan-500 rounded-full"></span>
                                            <span>{note}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/10">
                                      <div className="text-[8.5px] uppercase font-mono text-emerald-300 font-bold mb-1 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        RECURRENCE PREVENTION STRATEGY
                                      </div>
                                      <p className="text-slate-300 text-[9.5px] leading-relaxed">
                                        {queue.solution.prevention}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-500 font-mono">
            <span>SHOWING {filteredQueues.length} OF {queues.length} QUEUE VECTORS</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              NEXUS SCM SMQ2 MONITOR SYNCHRONIZED
            </span>
          </div>
        </div>

        {/* AI Investigation Workbench Drawer / Panel */}
        <AnimatePresence>
          {selectedQueue && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="glass-card rounded-2xl border border-cyan-500/30 p-6 relative overflow-hidden shadow-[0_0_35px_rgba(6,182,212,0.15)]"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                    <Bot size={18} />
                  </div>
                  <div>
                    {(() => {
                      const isSelectedUnlocked = simulatedUnlockedQueues.has(selectedQueue.id);
                      const selectedSeverity: QueueSeverity = isSelectedUnlocked ? 'RESOLVED' : selectedQueue.severity;
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-display font-bold text-white uppercase tracking-wider">
                            AI DIAGNOSIS: {selectedQueue.qname}
                          </span>
                          {selectedSeverity === 'CRITICAL' && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                              CRITICAL [{selectedQueue.severityCode}]
                            </span>
                          )}
                          {selectedSeverity === 'WARNING' && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              WARNING [{selectedQueue.severityCode}]
                            </span>
                          )}
                          {selectedSeverity === 'RESOLVED' && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 size={10} className="text-emerald-400" />
                              RESOLVED
                            </span>
                          )}
                          {selectedSeverity === 'INFO' && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              INFO
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono uppercase bg-white/5 text-slate-400 border border-white/10">
                            {isSelectedUnlocked ? 'RELEASED' : selectedQueue.status}
                          </span>
                        </div>
                      );
                    })()}
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Function: <span className="text-cyan-300">{selectedQueue.fname}</span> • Client: {selectedQueue.client} • Dest: {selectedQueue.destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateToEwmCommunity && (
                    <button
                      onClick={() => {
                        const ewmQuery = `SAP EWM queue ${selectedQueue.qname} failed in FM ${selectedQueue.fname}: ${selectedQueue.errorText}`;
                        onNavigateToEwmCommunity(ewmQuery);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all font-bold"
                      title="Search SAP EWM Community Hub for this specific queue issue"
                    >
                      <Globe size={12} />
                      <span>SEARCH EWM COMMUNITY</span>
                    </button>
                  )}

                  {onNavigateToChat && (
                    <button
                      onClick={() => {
                        const prompt = `Analyze this SAP SMQ2 queue error in detail:
Queue Name: ${selectedQueue.qname}
Status: ${selectedQueue.status}
Function Module: ${selectedQueue.fname}
Error Text: ${selectedQueue.errorText}
Please formulate a complete step-by-step remediation plan.`;
                        onNavigateToChat(prompt);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all"
                    >
                      <ExternalLink size={12} />
                      <span>OPEN IN NEURAL CHAT</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedQueue(null);
                      setAiDiagnosis(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Raw Error Notice Box */}
              <div className="mt-4 p-3.5 bg-black/50 border border-white/10 rounded-xl font-mono text-[10px]">
                <div className="text-[8.5px] uppercase tracking-widest text-slate-400 mb-1">
                  CAPTURED SMQ2 ERROR STRING:
                </div>
                <div className="text-rose-300 leading-relaxed font-semibold">
                  {selectedQueue.errorText}
                </div>
              </div>

              {/* AI Analysis Stream / Output */}
              <div className="mt-4">
                {isDiagnosing ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 font-mono">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                    <span className="text-[10px] text-cyan-300 uppercase tracking-widest animate-pulse">
                      DECODING QUEUE ANOMALY VIA COGNITIVE CORE...
                    </span>
                    <span className="text-[8px] text-slate-500">
                      Querying SAP S/4HANA & EWM Knowledge Base
                    </span>
                  </div>
                ) : aiDiagnosis ? (
                  <div className="prose prose-invert prose-sm max-w-none 
                    prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-[11px] prose-p:font-sans
                    prose-headings:font-display prose-headings:text-cyan-400 prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-[12px]
                    prose-strong:text-cyan-300
                    prose-code:text-rose-300 prose-code:bg-rose-950/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[10px]
                    prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10
                    prose-ul:text-[11px] prose-ol:text-[11px]
                  ">
                    <Markdown remarkPlugins={[remarkGfm]}>
                      {aiDiagnosis}
                    </Markdown>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comprehensive SAP SMQ2 Queue Clearing SOP Modal */}
        <AnimatePresence>
          {showClearingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 15 }}
                className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl glass-card border border-cyan-500/40 bg-[#070d18]/95 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/50 relative">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500"></div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                          SAP SMQ2 INBOUND QUEUE CLEARING PROTOCOL // ENTERPRISE SOP
                        </h2>
                        <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                          OFFICIAL RUNBOOK
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                        Standard Operating Procedures for Releasing, Resetting, and Remediating Inbound qRFCs
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyClearingSOP}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      {copiedId === 'clearing-sop' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedId === 'clearing-sop' ? 'COPIED TO CLIPBOARD' : 'COPY FULL SOP'}</span>
                    </button>

                    <button
                      onClick={() => setShowClearingModal(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="px-6 py-2 bg-black/30 border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
                  {[
                    { id: 'STANDARD', label: '1. SAP GUI CLEARING STEPS', icon: Terminal },
                    { id: 'STATUSES', label: '2. STATUS MATRIX (SYSFAIL/STOP)', icon: AlertTriangle },
                    { id: 'CASCADE', label: '3. CASCADE & FIFO DEPENDENCIES', icon: Layers },
                    { id: 'SAFETY_DELETE', label: '4. SAFE DELETION PROTOCOL', icon: ShieldAlert },
                    { id: 'BATCH_JOBS', label: '5. SMQR & BACKGROUND RECOVERY', icon: RefreshCw },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = clearingModalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setClearingModalTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider whitespace-nowrap transition-all border",
                          isActive
                            ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                            : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200"
                        )}
                      >
                        <Icon size={12} className={isActive ? "text-cyan-400" : "text-slate-500"} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Modal Body / Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[11px] font-sans scrollbar-thin scrollbar-thumb-white/10">
                  
                  {/* TAB 1: STANDARD SAP GUI CLEARING PROCEDURE */}
                  {clearingModalTab === 'STANDARD' && (
                    <div className="space-y-5">
                      <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
                        <Lightbulb size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-300 leading-relaxed">
                          <strong className="text-cyan-300 font-mono">CORE SAP RULE:</strong> SMQ2 queues represent transactional state transitions (e.g. goods receipt, delivery replication, freight order assignment). Always <strong className="text-white">resolve the underlying application error before activating</strong> the queue, or the queue will instantly fail again and re-enter <span className="font-mono text-rose-300">SYSFAIL</span>.
                        </div>
                      </div>

                      {/* 6 Step Interactive Timeline */}
                      <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                1
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Access Inbound Queue Monitor via Transaction Code <code className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">/nSMQ2</code>
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-slate-400 uppercase">T-Code: SMQ2</span>
                          </div>
                          <p className="text-slate-300 text-[10.5px] leading-relaxed pl-7">
                            In your SAP GUI command field, enter <strong className="font-mono text-cyan-300">/nSMQ2</strong>. On the selection screen:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[10px] pl-7 font-mono">
                            <li><strong className="text-white">Client:</strong> Enter the target productive client (e.g., <span className="text-cyan-300">100</span>).</li>
                            <li><strong className="text-white">Queue Name:</strong> Enter <span className="text-cyan-300">*</span> for all, or filter by module (e.g., <span className="text-cyan-300">WM*</span> for EWM, <span className="text-cyan-300">TM*</span> for TM, <span className="text-cyan-300">DLV*</span> for ERP deliveries).</li>
                            <li>Press <strong className="text-amber-300">[F8]</strong> to execute the query.</li>
                          </ul>
                        </div>

                        {/* Step 2 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                2
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Drill Down into the Queue LUWs (Logical Units of Work)
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-slate-400 uppercase">Double-Click Queue</span>
                          </div>
                          <p className="text-slate-300 text-[10.5px] leading-relaxed pl-7">
                            In the queue overview ALV table, <strong className="text-white">double-click on the Queue Name</strong> (e.g. <span className="font-mono text-cyan-300">WM00000000010482</span>). This opens the list of individual transactional packages waiting inside.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7 pt-1 font-mono text-[9px]">
                            <div className="p-2 rounded bg-black/60 border border-white/5">
                              <span className="text-slate-400 block">FUNCTION MODULE:</span>
                              <span className="text-cyan-300 font-bold truncate block">/SCWM/INB_DLV_SAVEREPLICA</span>
                            </div>
                            <div className="p-2 rounded bg-black/60 border border-white/5">
                              <span className="text-slate-400 block">CALLER USER:</span>
                              <span className="text-white font-bold block">ALEREMOTE / RFCUSER</span>
                            </div>
                            <div className="p-2 rounded bg-black/60 border border-white/5">
                              <span className="text-slate-400 block">DESTINATION:</span>
                              <span className="text-amber-300 font-bold block">NONE / LOCAL</span>
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                3
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Capture Error Text & Investigate ABAP Short Dumps via <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-500/30">/nST22</code>
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-rose-400 uppercase">Diagnostic Phase</span>
                          </div>
                          <p className="text-slate-300 text-[10.5px] leading-relaxed pl-7">
                            <strong className="text-white">Double-click the "Status" column text</strong> (e.g. <span className="font-mono text-rose-400">SYSFAIL</span>). SAP displays the exact runtime error string.
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[10px] pl-7">
                            <li>If the error states <strong className="text-white">"Runtime error ..."</strong> or <strong className="text-white">"Open SQL exception CX_SY_*"</strong>: Open <code className="text-cyan-300 font-mono">/nST22</code> in a parallel session.</li>
                            <li>In ST22, filter by the queue timestamp and user to inspect the ABAP stack trace, offending database query, and line number.</li>
                          </ul>
                        </div>

                        {/* Step 4 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                4
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Resolve Root Cause in the Appropriate Functional T-Code
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-amber-400 uppercase">Remediation Phase</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-7 pt-1 text-[10px]">
                            <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 space-y-1">
                              <span className="font-mono text-cyan-300 font-bold block">LOCK CONFLICT: SM12</span>
                              <p className="text-slate-300 text-[9.5px]">Open <code className="text-cyan-300">/nSM12</code>, search by table (<code className="text-cyan-300">/SCWM/*</code> or <code className="text-cyan-300">VBAK</code>). If user disconnected in <code className="text-cyan-300">SM04</code>, delete lock.</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 space-y-1">
                              <span className="font-mono text-purple-300 font-bold block">CUSTOMIZING / WPT: SPRO</span>
                              <p className="text-slate-300 text-[9.5px]">Maintain missing Warehouse Process Type in <code className="text-cyan-300">SPRO &rarr; Determine WPT</code> or verify product master <code className="text-cyan-300">/SCWM/MAT1</code>.</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 space-y-1">
                              <span className="font-mono text-emerald-300 font-bold block">DEFICIT STOCK: MMBE / MIGO</span>
                              <p className="text-slate-300 text-[9.5px]">Check unrestricted stock in <code className="text-cyan-300">MMBE</code> or <code className="text-cyan-300">/SCWM/MON</code>. Post transfer via <code className="text-cyan-300">MIGO</code> (mov 311) or reverse duplicates.</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 space-y-1">
                              <span className="font-mono text-rose-300 font-bold block">NUMBER RANGES: SNRO</span>
                              <p className="text-slate-300 text-[9.5px]">Extend upper limit intervals in <code className="text-cyan-300">SNRO</code> for the affected document object without overlapping.</p>
                            </div>
                          </div>
                        </div>

                        {/* Step 5 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                5
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Re-activate the Queue via <kbd className="text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono">[F6]</kbd> or Reset Status <kbd className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">[Shift+F5]</kbd>
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-emerald-400 uppercase">Execution</span>
                          </div>
                          <p className="text-slate-300 text-[10.5px] leading-relaxed pl-7">
                            Return to transaction <strong className="font-mono text-white">SMQ2</strong>. Select the queue row checkbox and apply the appropriate execution command:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[10px] pl-7 font-mono">
                            <li>If status is <span className="text-rose-400">SYSFAIL</span>: First choose menu <strong className="text-white">Edit -&gt; Reset Status (Shift+F5)</strong>, then choose <strong className="text-white">Edit -&gt; Activate (F6)</strong>.</li>
                            <li>If status is <span className="text-amber-400">STOP</span>: Choose <strong className="text-white">Edit -&gt; Unlock Queue (F5)</strong>, then press <strong className="text-white">F6</strong>.</li>
                            <li><strong className="text-emerald-300">Verification:</strong> The work process executes synchronously. The entries count decrements, and the queue clears from SMQ2 upon success!</li>
                          </ul>
                        </div>

                        {/* Step 6 */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                6
                              </span>
                              <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                                Advanced ABAP LUW Foreground Debugging
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono text-purple-400 uppercase">Debug Mode</span>
                          </div>
                          <p className="text-slate-300 text-[10.5px] leading-relaxed pl-7">
                            If the queue fails repeatedly without clear error text:
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[10px] pl-7 font-mono">
                            <li>Double-click the queue to display the list of LUWs.</li>
                            <li>Select the failing first LUW row.</li>
                            <li>Choose menu: <strong className="text-cyan-300">Edit -&gt; Debug LUW</strong>.</li>
                            <li>The SAP GUI will immediately open the <strong className="text-white">ABAP Debugger</strong> directly inside the function module. Step through (<kbd className="text-cyan-300">F5</kbd>/<kbd className="text-cyan-300">F6</kbd>) to observe exact sy-subrc returns and payload tables.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: STATUS MATRIX */}
                  {clearingModalTab === 'STATUSES' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* SYSFAIL */}
                        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold text-xs uppercase">
                              STATUS: SYSFAIL
                            </span>
                            <span className="text-[8px] font-mono text-rose-400">CRITICAL PRIORITY</span>
                          </div>
                          <p className="text-slate-300 text-[10px] leading-relaxed">
                            <strong className="text-white">System Failure.</strong> A hard crash, unhandled ABAP exception (<code className="text-rose-300">CX_*</code>), short dump in <code className="text-rose-300">ST22</code>, or missing structural customizing occurred during commit work.
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 space-y-1 text-[9.5px] font-mono">
                            <span className="text-cyan-300 block font-bold">CLEARING STEPS:</span>
                            <p className="text-slate-300">1. Inspect ST22 dump and application log (SLG1).</p>
                            <p className="text-slate-300">2. Fix code/customizing in target system.</p>
                            <p className="text-slate-300">3. SMQ2: Select Queue -&gt; Menu: Edit -&gt; Reset Status (Shift+F5).</p>
                            <p className="text-slate-300">4. Press F6 (Activate).</p>
                          </div>
                        </div>

                        {/* STOP */}
                        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-xs uppercase">
                              STATUS: STOP
                            </span>
                            <span className="text-[8px] font-mono text-amber-400">ADMIN / SCHEDULER HOLD</span>
                          </div>
                          <p className="text-slate-300 text-[10px] leading-relaxed">
                            <strong className="text-white">Queue Held.</strong> Either manually locked by a system administrator, or the qRFC scheduler exceeded the maximum retry count (<code className="text-amber-300">ATTEMPTS</code> in SMQR).
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 space-y-1 text-[9.5px] font-mono">
                            <span className="text-cyan-300 block font-bold">CLEARING STEPS:</span>
                            <p className="text-slate-300">1. Review reason why queue was put on hold.</p>
                            <p className="text-slate-300">2. SMQ2: Select Queue -&gt; Menu: Edit -&gt; Unlock Queue (F5).</p>
                            <p className="text-slate-300">3. Press F6 (Activate) to execute immediately.</p>
                          </div>
                        </div>

                        {/* RETRY */}
                        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono font-bold text-xs uppercase">
                              STATUS: RETRY
                            </span>
                            <span className="text-[8px] font-mono text-blue-400">TRANSIENT DELAY</span>
                          </div>
                          <p className="text-slate-300 text-[10px] leading-relaxed">
                            <strong className="text-white">Automatic Retry Interval Active.</strong> Encountered a transient lock contention or brief network hiccup. Scheduled to re-execute on the next timer pulse.
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 space-y-1 text-[9.5px] font-mono">
                            <span className="text-cyan-300 block font-bold">CLEARING STEPS:</span>
                            <p className="text-slate-300">1. Check SM12 to see if locking job finished.</p>
                            <p className="text-slate-300">2. Can wait for auto-retry, or select and press F6 to force run.</p>
                          </div>
                        </div>

                        {/* WAITING */}
                        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold text-xs uppercase">
                              STATUS: WAITING
                            </span>
                            <span className="text-[8px] font-mono text-purple-400">DEPENDENCY BLOCKADE</span>
                          </div>
                          <p className="text-slate-300 text-[10px] leading-relaxed">
                            <strong className="text-white">Waiting for Parent Queue.</strong> The queue itself is healthy, but cannot process because an earlier queue in the serialization group is blocked.
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 space-y-1 text-[9.5px] font-mono">
                            <span className="text-cyan-300 block font-bold">CLEARING STEPS:</span>
                            <p className="text-rose-400">⚠️ DO NOT DELETE OR FORCE-ACTIVATE THIS QUEUE!</p>
                            <p className="text-slate-300">1. Locate head queue with earliest creation timestamp.</p>
                            <p className="text-slate-300">2. Clear head queue. This waiting queue will auto-release.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CASCADE DEPENDENCY & FIFO ORDER */}
                  {clearingModalTab === 'CASCADE' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-purple-400" />
                          <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider">
                            qRFC Serialization & Head-of-Line Dependency Rules
                          </h3>
                        </div>
                        <p className="text-slate-300 text-[10px] leading-relaxed">
                          qRFC (queued Remote Function Call) is designed to guarantee <strong className="text-white">strict FIFO (First-In, First-Out) transaction serialization</strong>. For example, in Extended Warehouse Management:
                        </p>
                        <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[9.5px] text-slate-300 space-y-1.5">
                          <div className="flex items-center gap-2 text-rose-300">
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">HEAD QUEUE</span>
                            <span>WM00000000010482 [SYSFAIL: Lock Conflict on Inbound Delivery 18004921]</span>
                          </div>
                          <div className="text-slate-500 pl-4">↓ (Blocks all downstream delivery updates)</div>
                          <div className="flex items-center gap-2 text-purple-300">
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">CHILD QUEUE 1</span>
                            <span>WM00000000010483 [WAITING: Warehouse Task Creation]</span>
                          </div>
                          <div className="text-slate-500 pl-4">↓</div>
                          <div className="flex items-center gap-2 text-purple-300">
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30">CHILD QUEUE 2</span>
                            <span>WM00000000010484 [WAITING: Goods Receipt Confirmation to ERP]</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <span className="font-display font-bold text-white text-xs uppercase tracking-wider block">
                          HOW TO IDENTIFY AND UNBLOCK THE HEAD QUEUE:
                        </span>
                        <ol className="list-decimal list-inside space-y-2 text-slate-300 text-[10px] leading-relaxed">
                          <li>
                            <strong className="text-white">Sort by Timestamp:</strong> In SMQ2, click the column header for "Date/Time" to sort ascending. The oldest queue is almost always the blocker.
                          </li>
                          <li>
                            <strong className="text-white">Inspect Child Status Text:</strong> Double-click the child queue status. The message will typically state: <span className="font-mono text-cyan-300">"Queue waiting for queue [PARENT_NAME] resolution"</span>.
                          </li>
                          <li>
                            <strong className="text-white">Resolve Parent Only:</strong> Once the parent queue is resolved and activated, SAP's qRFC dispatcher triggers the remaining waiting child queues in strict chronological sequence.
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SAFETY & SAFE DELETION */}
                  {clearingModalTab === 'SAFETY_DELETE' && (
                    <div className="space-y-4">
                      {/* Danger Banner */}
                      <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/50 space-y-2">
                        <div className="flex items-center gap-2 text-rose-300 font-bold">
                          <ShieldAlert size={18} className="text-rose-400 shrink-0" />
                          <span className="text-xs uppercase tracking-wider font-mono">
                            CRITICAL SYSTEM INTEGRITY WARNING: NEVER BLINDLY DELETE QUEUES
                          </span>
                        </div>
                        <p className="text-slate-300 text-[10px] leading-relaxed">
                          Deleting an inbound delivery or freight queue permanently destroys the payload data in the receiving system without informing the sender system. This results in <strong className="text-rose-300">ghost documents, split inventory reconciliations, and permanent financial document imbalances</strong> between S/4HANA ERP, EWM, and TM!
                        </p>
                      </div>

                      {/* Deletion Criteria */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                        <span className="font-display font-bold text-white text-xs uppercase tracking-wider block">
                          SAFE DELETION PROTOCOL (LAST RESORT ONLY):
                        </span>
                        <div className="space-y-2 text-[10px] text-slate-300">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong className="text-white">Condition 1:</strong> The business confirms the original source document was completely cancelled or deleted in the sender system.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong className="text-white">Condition 2:</strong> A duplicated IDoc or delivery update already successfully posted via another queue.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span><strong className="text-white">Condition 3:</strong> You have a verified mechanism to re-trigger the document fresh from the source system.</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1 font-mono text-[9px]">
                          <span className="text-amber-300 font-bold block">HOW TO DELETE A SPECIFIC LUW IN SMQ2:</span>
                          <p className="text-slate-300">1. Double-click the queue name to view the list of LUWs.</p>
                          <p className="text-slate-300">2. Select the specific failing LUW row (do not delete the entire queue if it contains other valid units).</p>
                          <p className="text-slate-300">3. Choose menu: <strong className="text-white">Edit -&gt; Delete Selected LUW (Shift+F2)</strong>.</p>
                          <p className="text-slate-300">4. Confirm the safety warning prompt.</p>
                        </div>
                      </div>

                      {/* Re-triggering guide */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <span className="font-display font-bold text-white text-xs uppercase tracking-wider block">
                          RE-TRIGGERING DOCUMENTS AFTER DELETION:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9.5px] font-mono">
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-cyan-300 font-bold block">ERP INBOUND DELIVERIES:</span>
                            <span className="text-slate-400">Transaction VL06I / VL02N -&gt; Issue Delivery Output to repeat ALE replication.</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-cyan-300 font-bold block">EWM INBOUND DELIVERIES:</span>
                            <span className="text-slate-400">Transaction /SCWM/PRDI -&gt; Select Delivery -&gt; Outbound Send to ERP.</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-cyan-300 font-bold block">IDOC EDI MESSAGES:</span>
                            <span className="text-slate-400">Transaction BD87 (Status 51/69 reprocessing) or WE19 (Test tool payload resend).</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-cyan-300 font-bold block">TM FREIGHT ORDERS:</span>
                            <span className="text-slate-400">Transaction /SCMTMS/TOR -&gt; Change status or trigger manual ERP sync.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: BATCH JOBS & SMQR */}
                  {clearingModalTab === 'BATCH_JOBS' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={16} className="text-cyan-400" />
                          <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider">
                            Automated Background Queue Recovery & SMQR Inbound Scheduler
                          </h3>
                        </div>
                        <p className="text-slate-300 text-[10px] leading-relaxed">
                          To prevent manual intervention for temporary hiccups, SAP provides standard batch report programs and the <code className="text-cyan-300">SMQR</code> inbound queue scheduler.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                        {/* RSQIWKEX */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <span className="font-mono text-cyan-300 font-bold block text-[11px]">
                            REPORT: RSQIWKEX (qRFC Inbound Restart)
                          </span>
                          <p className="text-slate-300 leading-relaxed text-[9.5px]">
                            Standard SAP program that searches for queues in status <span className="font-mono text-amber-300">STOP</span> or <span className="font-mono text-blue-300">RETRY</span> and restarts their processing.
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 font-mono text-[9px] space-y-1">
                            <span className="text-slate-400 block">RECOMMENDED SCHEDULE:</span>
                            <p className="text-white">Transaction SM36 -&gt; Hourly periodic background job.</p>
                            <p className="text-slate-400">Queue Name: <span className="text-cyan-300">*</span>, Max Runtime: <span className="text-cyan-300">300s</span></p>
                          </div>
                        </div>

                        {/* RSARFCEX */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <span className="font-mono text-cyan-300 font-bold block text-[11px]">
                            REPORT: RSARFCEX (ARFC Restart Engine)
                          </span>
                          <p className="text-slate-300 leading-relaxed text-[9.5px]">
                            Executes stuck asynchronous RFCs that experienced communication timeouts or temporary gateway saturation in <code className="text-cyan-300">SM58</code>.
                          </p>
                          <div className="p-2.5 rounded bg-black/60 border border-white/5 font-mono text-[9px] space-y-1">
                            <span className="text-slate-400 block">RECOMMENDED SCHEDULE:</span>
                            <p className="text-white">Transaction SM36 -&gt; Every 30 minutes in production.</p>
                            <p className="text-slate-400">Target User: <span className="text-cyan-300">ALEREMOTE</span></p>
                          </div>
                        </div>
                      </div>

                      {/* SMQR Configuration */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <span className="font-display font-bold text-white text-xs uppercase tracking-wider block">
                          qRFC INBOUND SCHEDULER: TRANSACTION <code className="text-cyan-300 font-mono">/nSMQR</code>
                        </span>
                        <p className="text-slate-300 text-[10px] leading-relaxed">
                          In transaction <strong className="text-white">SMQR</strong>, ensure the scheduler status is <strong className="text-emerald-400">ACTIVE</strong>. Register queues to distribute workload across available dialogue work processes:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[9px]">
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-slate-500 block">QUEUE NAME:</span>
                            <span className="text-cyan-300 font-bold">WM* / TM* / *</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-slate-500 block">MAX-RUNTIME:</span>
                            <span className="text-white font-bold">60 SECONDS</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-slate-500 block">ATTEMPTS:</span>
                            <span className="text-amber-300 font-bold">30 RETRIES</span>
                          </div>
                          <div className="p-2 rounded bg-black/60 border border-white/5">
                            <span className="text-slate-500 block">PAUSE:</span>
                            <span className="text-emerald-300 font-bold">60 SECONDS</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 bg-black/60 border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Terminal size={12} className="text-cyan-400" />
                    <span>COMMON COMMANDS: /nSMQ2 • /nSM12 • /nST22 • /nSPRO • /nSMQR</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyClearingSOP}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <Copy size={11} />
                      <span>COPY CHECKLIST</span>
                    </button>
                    <button
                      onClick={() => setShowClearingModal(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white uppercase tracking-wider transition-all"
                    >
                      CLOSE GUIDE
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default QueueAnalysisView;
