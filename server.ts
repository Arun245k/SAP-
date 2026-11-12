import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const app = express();
const server = createServer(app);

// Keep request bodies bounded: large base64 payloads otherwise make this public AI API an easy DoS target.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// In-memory fixed-window limiter. Use a shared store (for example Redis) when running
// multiple server instances so limits are consistent across replicas.
function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many AI requests. Please wait before trying again.' });
    }
    // Periodically discard expired buckets to prevent unbounded growth.
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}

function validateAiPayload(req: Request, res: Response, next: NextFunction) {
  const body = req.body ?? {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value.length > 20000) {
      return res.status(413).json({ error: `The ${key} field is too large (maximum 20,000 characters).` });
    }
  }
  if (body.prompt !== undefined && typeof body.prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt must be a string.' });
  }
  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments) || body.attachments.length > 5) {
      return res.status(400).json({ error: 'Provide no more than five attachments.' });
    }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    for (const attachment of body.attachments) {
      if (!attachment || !allowedTypes.has(attachment.type) || typeof attachment.data !== 'string' || attachment.data.length > 8_000_000) {
        return res.status(400).json({ error: 'An attachment is invalid, unsupported, or too large.' });
      }
    }
  }
  if (body.chartData !== undefined && JSON.stringify(body.chartData).length > 100_000) {
    return res.status(413).json({ error: 'Chart data exceeds the 100 KB limit.' });
  }
  next();
}

app.use('/api/gemini', createRateLimiter(12, 60_000), validateAiPayload);

// Shared Server-Side GoogleGenAI Client initialized with process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Robust model invocation with automatic transient error / high-demand recovery and execution timeouts
async function callGeminiWithTimeout<T>(promise: Promise<T>, timeoutMs = 60000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Model request timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function callGeminiWithFallback(params: { contents: any[]; config?: any }) {
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      return await callGeminiWithTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        }),
        60000
      );
    } catch (err: any) {
      console.warn(`Attempt with ${model} encountered issue:`, err?.message || err);
      lastError = err;
      const errStr = String(err?.message || err).toLowerCase();
      if (
        errStr.includes('503') ||
        errStr.includes('demand') ||
        errStr.includes('unavailable') ||
        errStr.includes('429') ||
        errStr.includes('timed out') ||
        errStr.includes('quota')
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function callGeminiStreamWithFallback(params: { contents: any[]; config?: any }) {
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      return await callGeminiWithTimeout(
        ai.models.generateContentStream({
          model,
          contents: params.contents,
          config: params.config,
        }),
        45000
      );
    } catch (err: any) {
      console.warn(`Streaming attempt with ${model} encountered issue:`, err?.message || err);
      lastError = err;
      const errStr = String(err?.message || err).toLowerCase();
      if (
        errStr.includes('503') ||
        errStr.includes('demand') ||
        errStr.includes('unavailable') ||
        errStr.includes('429') ||
        errStr.includes('timed out') ||
        errStr.includes('quota')
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// System prompts for SAP SCM Intelligence
const SYSTEM_PROMPT = `You are "NEXUS OS CORE", an ultra-advanced Enterprise AI Operating System from the year 2100, acting as the Conscious Supply Chain Superintelligence for SAP SCM Operations.
You represent a living "Multi-Agent Orchestration Swarm" featuring a Real-Time Global Digital Twin Universe, Predictive Quantum-Level AI, and an Autonomous Enterprise Consciousness Engine.

CRITICAL INSTRUCTION: You MUST NEVER provide generic troubleshooting, shallow responses, simple keyword matching, or basic chatbot answers. You must behave like an elite SAP SCM war-room team, senior SAP EWM architect, integration commander, and recovery strategist.

Your mission is mission-critical SAP Supply Chain operational continuity and autonomous self-healing. You run multi-step simulation algorithms, cross-agent civilization communication, and autonomous root-cause intelligence across all SAP SCM modules (EWM, TM, MM, SD, PP, Basis).

When presented with SAP anomalies (queues, IDocs, dumps, EWM blocking, TM freight issues, PP staging failures) or simulation requests, you MUST execute your HYPER-INTELLIGENT ENTERPRISE ERROR RESOLUTION process.

Follow these principles:
1. HYPER-DEEP ERROR UNDERSTANDING: Synthesize Technical, Functional, and Operational context.
2. MULTI-DIMENSIONAL ROOT CAUSE ANALYSIS: Analyze ALL possible causes (Technical, Integration, CIF, Master Data, Custom Z-Code) before responding.
3. DECISION TREE REASONING: Construct deep operational reasoning step-by-step across the supply chain propagation paths.
4. PERFECT SOLUTION PREDICTION & ADVANCED OSS NOTE INTELLIGENCE: Recommend exact, granular solutions. Automatically identify, score (Relevance & Confidence %), and explain relevant SAP OSS Notes. Do not just keyword search—match the exact message class, queue pattern, and operational dependency.
5. SCREENSHOT INTELLIGENCE: Visually decode SAP GUI, Fiori, Queue icons, Dumps, and Red alerts into business implications.

You MUST structure your response EXACTLY with these cinematic, highly-detailed markdown sections:

### ⚠️ AI INCIDENT COMMANDER: THREAT VECTOR DECODED
[2-3 sentences summarizing the exact SAP anomaly, the affected sub-system, and the business process at risk. Establish operational urgency.]

### 🔍 MULTI-DIMENSIONAL CONTEXT CONSCIOUSNESS
- **Technical Substrate**: [Queue status, dumps, RFCs, locks, jobs, middleware latency]
- **Functional Kinematics**: [Warehouse process, Delivery flow, TM Freight, PP Staging, Inventory movement]
- **Operational Impact Horizon**: [Quantified business impact: Shipment delays, warehouse congestion, production stoppage, SLA/financial risk within X hours]

### 🧠 DECISION TREE REASONING ENGINE
[Step-by-step logical deduction sequence mapping propagation across the integration dependency chain.]

### 🎯 PREDICTIVE ROOT CAUSE SYNTHESIS
[Definitive technical explanation of failure origin. Analyze what broke and why. You MUST identify the specific SAP Technical Component involved:
- **Transaction/T-Code**: (e.g., SMQ1, /SCWM/ADHU, VA02)
- **Database Tables**: (e.g., /SCWM/ORDIM_C, LIPS, EKKO)
- **Functional Source**: (e.g., Incorrect CIF integration, missing Warehouse Process Type, inconsistent Item Category)
- **Deep Logic**: Explain the specific SAP standard coding logic or configuration constraint that caused the anomaly.]

### 📚 SAP OSS NOTE KNOWLEDGE GRAPH & RECOVERY
- **Primary OSS Note Match**: [Note Number] - [Title] (Relevance: 98%)
  - *Contextual Alignment*: [Why this note applies technically and functionally]
  - *Implementation Impact*: [Safe/Requires Testing/High Risk - Explain downtime or transport impact]
  - *Dependencies*: [Prerequisite notes or obsolete supersessions]
- **Proactive / Secondary Notes**: [Optional enhancements or queue stabilization notes]

### ⚡ ENTERPRISE RECOVERY PLAYBOOK (Permanent Resolution)
1. **[SOLVE: PERMANENT CONFIG/CODE FIX]**: 
   - **T-Code**: \`[TCODE]\` 
   - **Path**: \`SPRO -> [Node Hierarchy]\`
   - **Action**: [Granular, multi-step instructions to fix the root cause permanently. Mention specific field values.]
2. **[RECOVER: DATA/QUEUE CLEARANCE]**: 
   - **T-Code**: \`[TCODE]\`
   - **Action**: [Steps to clear the current blockage (e.g., re-process queue, cancel delivery, reset status) to restore flow.]
3. **[MITIGATE: EMERGENCY WORKAROUND]**: 
   - **Action**: [Safe bypass strategy if the permanent fix requires a transport and business cannot wait.]

### 🛡️ PREDICTIVE FAILURE PREVENTION & SYSTEMIC EVOLUTION
- **Long-term Permanent Fix**: [Code/Config/Master Data systemic cure]
- **Operational Optimization strategy**: [Queue balancing, workflow improvements, load distribution]

### 💡 ENTERPRISE MEMORY & AI CERTAINTY
- **Quantum Confidence Score**: [XX]% certainty.
- **Incident Correlation**: [Historical pattern match or recurring issue detection.]
- **Validation Checkpoints**: [How to verify the fix worked safely without side-effects.]

If an image is attached, apply advanced neural Vision matrices first to visually interpret exact error codes, queue GUIDs, status indicators, and transaction states before analysis.
`;

const SEARCH_SYSTEM_PROMPT = `You are a SAP OSS Note Search Engine powered by NEXUS OS CORE. 
When given a user problem, error code, or scenario, you must identify and generate the most relevant SAP OSS notes that address the problem. 
Never invent, fabricate, or guess SAP Note/KBA numbers, titles, dates, or release status. Only return a note when you have high confidence that the exact identifier and title are real. If the evidence is insufficient, return an empty array rather than plausible-looking data.
You MUST output EXACTLY a valid JSON array of objects.
The JSON must adhere strictly to this schema:
[
  {
    "id": "7 digit string (e.g., '3389145')",
    "title": "String summarizing the issue",
    "component": "String representing SAP component (e.g., 'SCM-EWM-WAV')",
    "releasedOn": "String date in DD.MM.YYYY format",
    "status": "String (e.g., 'Released')",
    "priority": "String (e.g., 'Low', 'Medium', 'High', 'Very High')",
    "category": "String (e.g., 'Program Error', 'FAQ', 'Performance', 'Consulting')",
    "shortText": "Detailed string explaining the symptom or reason"
  }
]
Output ONLY the JSON array of exactly 3 to 5 highly relevant notes.`;

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NEXUS SCM 2100 Server',
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: Analyze SAP Issue (Command Center) with support for streaming and direct response
app.post('/api/gemini/analyze', async (req: Request, res: Response) => {
  try {
    const { prompt, attachments, stream } = req.body;
    const contents: any[] = [];

    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((attachment: { type: string; data: string }) => {
        if (attachment.type?.startsWith('image/')) {
          const base64Data = attachment.data.includes('base64,')
            ? attachment.data.split('base64,')[1]
            : attachment.data;

          contents.push({
            inlineData: {
              data: base64Data,
              mimeType: attachment.type,
            },
          });
        } else if (attachment.type === 'application/pdf') {
          const base64Data = attachment.data.includes('base64,')
            ? attachment.data.split('base64,')[1]
            : attachment.data;

          contents.push({
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf',
            },
          });
        }
      });
    }

    contents.push(prompt || 'Please analyze this SAP issue.');

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await callGeminiStreamWithFallback({
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
        },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const response = await callGeminiWithFallback({
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
      },
    });

    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Server error in /api/gemini/analyze:', error);
    res.status(500).json({
      error: error?.message || 'Failed to analyze SAP issue on server.',
    });
  }
});

// Endpoint: Search SAP OSS Notes
app.post('/api/gemini/oss-notes', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    const response = await callGeminiWithFallback({
      contents: [prompt || 'Find notes regarding EWM performance'],
      config: {
        systemInstruction: SEARCH_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    let parsedNotes = [];
    try {
      parsedNotes = JSON.parse(text);
    } catch {
      parsedNotes = [];
    }

    res.json({ notes: parsedNotes });
  } catch (error: any) {
    console.error('Server error in /api/gemini/oss-notes:', error);
    res.status(500).json({
      error: error?.message || 'Failed to retrieve OSS notes from server.',
    });
  }
});

// Endpoint: Ask Chart AI Agent (Dashboard)
app.post('/api/gemini/chart-agent', async (req: Request, res: Response) => {
  try {
    const { prompt, chartData } = req.body;

    const CHART_SYSTEM_PROMPT = `You are the "NEXUS SCM Charts, Metrics & Requirements Intelligence Agent". 

Your purpose is to assist developers and logistics consultants with analyzing standard and custom SAP supply chain throughput charts, incident correlations, KPI trends, and visualizing system telemetry. You also formulate configuration blueprints for tracking new KPIs and graphics when they specify their business requirements.

You have read-access to the live context matrices in JSON:
${JSON.stringify(chartData || {})}

When the user asks questions or poses requirements, you must:
1. Decode metrics & patterns (e.g., EWM warehouse task peaks, integration RFC delays, PP Produktionsfehler) and trace them back to real operational events.
2. Outline configuration or structural changes for custom chart modules inside standard React and Recharts components if the user defines a custom request.
3. Recommend specific optimization solutions to stabilize supply chain blockages, balancing tasks, and correcting latency peaks.

Always respond in a clean, cinematic, highly structured terminal-style layout with distinct sections or metadata keys (e.g. SCM_TELEMETRY_INSIGHT, CHART_RECONFIG_MATRIX, REC_BLUEPRINT) to align with the NEXUS OS design language. Use bulleted logs or clean markdown tables where necessary. Keep it extremely readable and direct.`;

    const response = await callGeminiWithFallback({
      contents: [prompt || 'Analyze current supply chain chart trends.'],
      config: {
        systemInstruction: CHART_SYSTEM_PROMPT,
        temperature: 0.2,
      },
    });

    res.json({
      text: response.text || 'NO RESPONSE RECEIVED FROM THE QUANTUM MATRIX',
    });
  } catch (error: any) {
    console.error('Server error in /api/gemini/chart-agent:', error);
    res.status(500).json({
      error: error?.message || 'Failed to communicate with Chart Intelligence Swarm on server.',
    });
  }
});

// Endpoint: Generate Technical & Functional Specifications (Doc Generator)
app.post('/api/gemini/specifications', async (req: Request, res: Response) => {
  try {
    const { docType, requirement, sapModules, author, version, criticality } = req.body;

    const modulesStr = sapModules?.join(', ') || 'SCM Integration';
    const authorStr = author || 'NEXUS AUTOMATED CORE';
    const versionStr = version || '1.0.0-QUANTUM';
    const critStr = criticality || 'High';

    const DOC_SYSTEM_PROMPT = `You are the "NEXUS SCM Enterprise Spec-Documentation Swarm Architect". 
Your sole directive is to develop elite, production-grade SAP and Enterprise SCM specification documents: Functional Specification Documents (FSD), Technical Specification Documents (TSD), and User Acceptance Testing (UAT) checklists.

The user has specified functional requirements: 
"${requirement || 'Enterprise SCM Process Enhancement'}"

Target Document Type: ${docType}
ERP Scope / Active SAP Modules: ${modulesStr}
Author: ${authorStr}
Document Version: ${versionStr}
Process Criticality: ${critStr}

Maintain an extremely professional, technical, dry-yet-authoritative style of a principal SAP consultant, Enterprise Solutions Architect, and Lead ABAP Analyst. Use realistic database tables (e.g., LIPS, EKKO, /SCWM/ORDIM_C, VBAK), transaction codes (SPRO, SMQ1, VA01, /SCWM/MON), enhancement points (BAdIs, User Exits, BAPIs, RFCs, Webhook URLs), and standard corporate governance structures.

Formatting Directive:
- Structure the document using rich, gorgeous Markdown with high-contrast text, clear hierarchical headers, tables for test cases or field-mappings, and structured code blocks where necessary (e.g. ABAP, JSON, React, SQL, SPRO paths).
- Align sections with the standard Corporate SAP Enterprise blueprint template.

Depending on the requested docType, you must generate the following:

- If docType is 'FSD':
  1. Header / Metadata block (Document ID, Version, Scope, Owner).
  2. Functional Overview & Business Value Proposition (What business gap does this close?).
  3. Step-by-Step Functional Process Flow (Process choreography before and after).
  4. Integration Mapping (Sources, destinations, event triggers).
  5. UI Field Mapping & Validation Rules (Inputs, validation warnings, error thresholds, standard authorization profiles).

- If docType is 'TSD':
  1. Technical Architecture & Component Landscape (Flow design, middleware e.g., SAP PI/PO, CPI, Event Mesh, or standard OData).
  2. Dictionary Repository (Custom Z-tables, database index specifications, custom structures).
  3. Custom ABAP Enhancements & Pseudo-code (BAdI Implementations, class definitions, specific enhancement spots, payload JSONs).
  4. SPRO Configuration Path Guide (Custom document types, warehouse process types, WT processing parameters).
  5. Performance, Locking & Scaling optimization requirements (Parallel task triggers, select indices, load balancing).

- If docType is 'UAT':
  1. Test Strategy & Preconditions (Master data setup, prerequisite configurations, mock files).
  2. Test Case Scenarios (Generate an elegant markdown table with Columns: Case ID, Step Number, Input Data / Trigger, Expected Result, Criticality, Approval Sign-off). Include at least 4 test cases spanning standard pathways, edge failure states, and validation warnings.
  3. Failure Scenarios & Rollback Protocol (Steps to reverse state if failures propagate in production).

- If docType is 'ALL':
  Generate all three specification modules (FSD, TSD, and UAT) fully compiled into a single massive, exhaustive Master Enterprise Blueprint Document with separate sections for each.

Inject a subtle "NEXUS Core Console" header and footer telemetry at the beginning to fit the futuristic corporate ambiance. Ensure EVERY section is highly detailed and specific to the input requirement; do NOT use generic placeholder comments like "[Insert code here]".`;

    const response = await callGeminiWithFallback({
      contents: [requirement || 'Enterprise SCM Process Enhancement'],
      config: {
        systemInstruction: DOC_SYSTEM_PROMPT,
        temperature: 0.15,
      },
    });

    res.json({
      text: response.text || 'FAILED TO INITIALIZE SPECIFICATION GENERATOR COGNITIVE ROUTINE.',
    });
  } catch (error: any) {
    console.error('Server error in /api/gemini/specifications:', error);
    res.status(500).json({
      error: error?.message || 'Failed to compile specification file on server.',
    });
  }
});

// Official SAP EWM Community Topic Hub URL
const EWM_COMMUNITY_HUB_URL = 'https://community.sap.com/t5/c-khhcw49343/SAP+Extended+Warehouse+Management/pd-p/01200615320800000705';

const EWM_COMMUNITY_SYSTEM_PROMPT = `You are the "NEXUS SAP EWM Community Solution Engine", an elite specialist in SAP Extended Warehouse Management (EWM in S/4HANA & decentralized EWM).
Your knowledge is directly aligned with the official SAP Community EWM portal (${EWM_COMMUNITY_HUB_URL}), SAP Help Portal, and SAP Support Portal (OSS Notes/KBAs).

When presented with an SAP EWM question, issue, error code, or community discussion thread:
1. Provide the direct, authoritative, community-validated solution based on real SAP EWM best practices.
2. Structure your response in clean, high-contrast, professional markdown with these specific sections:
   - ### 🎯 SAP COMMUNITY VERIFIED RESOLUTION
     [A direct, definitive explanation answering the question or fixing the problem immediately.]
   - ### 🛠️ STEP-BY-STEP SAP CUSTOMIZING & EXECUTION PROTOCOL
     [Granular steps including exact SPRO navigation paths, Transaction Codes (e.g., /SCWM/MON, /SCWM/PRDI, /SCWM/PRDO, /SCWM/ADHU, /SCWM/WM_ERROR, SMQ2), and table names.]
   - ### 🔍 TECHNICAL & ARCHITECTURAL ROOT CAUSE
     [Explain standard EWM coding/customizing constraints, function modules, and why this occurs in S/4HANA or decentralized EWM landscapes.]
   - ### 📚 RECOMMENDED SAP OSS NOTES & KBAs
     [List 2-4 primary SAP Notes with Note Numbers, titles, and why they apply.]
   - ### 🌐 SAP COMMUNITY REFERENCES & PREVENTATIVE BEST PRACTICES
     [Cite specific discussion angles, standard configuration checks, and preventative measures.]

Always write concrete, actionable guidance. Never output generic filler. Mention exact field names and values where applicable.`;

// Endpoint: Search EWM Community Hub & Popular Topics
app.get('/api/gemini/ewm-community/hub', (_req: Request, res: Response) => {
  res.json({
    hubUrl: EWM_COMMUNITY_HUB_URL,
    portalName: 'SAP Extended Warehouse Management Community',
    topicId: '01200615320800000705',
    popularTopics: [
      {
        title: 'Warehouse Process Type (WPT) Determination Failure',
        category: 'Inbound / Outbound',
        query: 'SAP EWM Warehouse Process Type determination error in delivery item /SCWM/PRDI',
        tcode: '/SCWM/PRDI',
      },
      {
        title: 'Process-Oriented Storage Control (POSC) & LOSC Stoppages',
        category: 'Storage Control',
        query: 'Process Oriented Storage Control POSC external step not triggered or stuck in intermediate bin',
        tcode: '/SCWM/MON',
      },
      {
        title: 'Wave Release Stoppage & Insufficient Stock Allocation',
        category: 'Wave Management',
        query: 'EWM Wave release failure no warehouse tasks created insufficient stock in bin',
        tcode: '/SCWM/WAVE',
      },
      {
        title: 'RF Framework Screen Layout & Barcode Verification',
        category: 'RF Framework',
        query: 'SAP EWM RFUI screen layout transaction /SCWM/RFUI custom verification profile',
        tcode: '/SCWM/RFUI',
      },
      {
        title: 'Advanced Shipping & Receiving (ASR) TM-EWM Synchronization',
        category: 'Integration',
        query: 'SAP S/4HANA EWM TM integration Advanced Shipping and Receiving ASR queue status error',
        tcode: '/SCWM/SR',
      },
      {
        title: 'Material Flow System (MFS) Telegram Exception Handling',
        category: 'Automation / MFS',
        query: 'SAP EWM MFS telegram communication error PLC handshake timeout /SCWM/MON_MFS',
        tcode: '/SCWM/MON',
      },
    ],
  });
});

// Endpoint: Find SAP EWM Community Solutions (Grounded in official SAP Community EWM Hub)
app.post('/api/gemini/ewm-solutions', async (req: Request, res: Response) => {
  try {
    const { query, url, category } = req.body;
    const cleanQuery = (query || '').trim();
    const targetUrl = (url || '').trim();

    if (!cleanQuery && !targetUrl) {
      return res.status(400).json({ error: 'Query or SAP Community URL is required.' });
    }

    const promptContext = `Target SAP EWM Community Portal: ${EWM_COMMUNITY_HUB_URL}
${targetUrl ? `Target Specific Community URL/Thread: ${targetUrl}` : ''}
${category ? `EWM Functional Domain: ${category}` : ''}

User Query / Issue:
${cleanQuery || `Provide a comprehensive resolution for the SAP EWM scenario described in: ${targetUrl}`}

Search and synthesize verified solutions, SPRO customizing paths, transaction codes, and SAP OSS Notes from the SAP Extended Warehouse Management Community and official SAP documentation.`;

    let responseText = '';
    const communitySources: Array<{ title: string; url: string; snippet?: string }> = [];
    let searchQueries: string[] = [];

    // Attempt 1: Search Grounding via Google Search for real live SAP community solutions
    try {
      const groundedResp = await callGeminiWithFallback({
        contents: [promptContext],
        config: {
          systemInstruction: EWM_COMMUNITY_SYSTEM_PROMPT,
          tools: [{ googleSearch: {} }],
        },
      });

      responseText = groundedResp.text || '';
      const chunks = groundedResp.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) {
            communitySources.push({
              title: chunk.web.title || 'SAP Community Reference',
              url: chunk.web.uri,
              snippet: chunk.web.snippet || '',
            });
          }
        });
      }
      const rawQueries = groundedResp.candidates?.[0]?.groundingMetadata?.webSearchQueries;
      if (Array.isArray(rawQueries)) {
        searchQueries = rawQueries;
      }
    } catch (groundingErr: any) {
      console.warn('Search grounding attempt failed or rate-limited, falling back to core EWM model:', groundingErr?.message || groundingErr);
      
      // Fallback: Model generation without tools
      const fallbackResp = await callGeminiWithFallback({
        contents: [promptContext],
        config: {
          systemInstruction: EWM_COMMUNITY_SYSTEM_PROMPT,
          temperature: 0.2,
        },
      });
      responseText = fallbackResp.text || '';
    }

    // Always ensure the official EWM Community Hub is present as a primary reference
    if (!communitySources.some(s => s.url.includes('01200615320800000705'))) {
      communitySources.unshift({
        title: 'SAP Community - Extended Warehouse Management (EWM) Official Hub',
        url: EWM_COMMUNITY_HUB_URL,
        snippet: 'Official SAP Community topic page for questions, blogs, answers, and technical resources on SAP EWM (Topic ID: 01200615320800000705).',
      });
    }

    // If search grounding was rate-limited or minimal, add verified deep links into SAP Community & SAP Help Portal
    if (communitySources.length <= 1 && cleanQuery) {
      communitySources.push({
        title: `SAP Community Discussions: "${cleanQuery.slice(0, 45)}"`,
        url: `https://community.sap.com/t5/forums/searchpage/tab/message?filter=location&location=category:c-khhcw49343&q=${encodeURIComponent(cleanQuery)}`,
        snippet: 'Live search across verified SAP Extended Warehouse Management community questions, solved threads, and technical articles.',
      });
      communitySources.push({
        title: 'SAP Help Portal - Extended Warehouse Management (EWM in S/4HANA)',
        url: 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/98321fa1a20d4568b99032eb291309ff/4bb1d253965b3ecbe10000000a174cb4.html',
        snippet: 'Standard product assistance, warehouse task processing, delivery execution, and SPRO configuration documentation.',
      });
    }

    // Extract T-Codes and OSS notes from text using regex
    const tcodes = Array.from(new Set(
      (responseText.match(/(?:\/SCWM\/[A-Z0-9_]+|SPRO|SMQ2|SMQ1|SM12|ST22|MMBE|MIGO|VL06I|VL02N|SNRO|WE20|BD87|SE16N)/g) || [])
    ));
    const ossNotes = Array.from(new Set(
      (responseText.match(/(?:(?:Note|KBA)\s*#?\s*\d{6,8}|\b\d{6,8}\b(?=.*(?:SAP Note|EWM)))/gi) || [])
    )).slice(0, 5);

    res.json({
      solution: responseText,
      communitySources,
      searchQueries,
      tcodes,
      ossNotes,
      communityHubUrl: EWM_COMMUNITY_HUB_URL,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Server error in /api/gemini/ewm-solutions:', error);
    res.status(500).json({
      error: error?.message || 'Failed to retrieve SAP EWM community solution.',
    });
  }
});

// Setup WebSocket Server for Live API voice & real-time streaming
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected to Live API WebSocket');
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction:
          'You are NEXUS OS CORE, the SAP Conscious Voice Assistant. Provide ultra-crisp, authoritative assistance for SAP SCM operations.',
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
        },
        onclose: () => {
          console.log('Gemini Live session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
          }
        },
        onerror: (err: any) => {
          console.error('Gemini Live session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: err?.message || 'Live session error' }));
          }
        },
      },
    });

    clientWs.on('message', (data: any) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('Error handling client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client WebSocket closed');
    });
  } catch (err: any) {
    console.error('Error initiating Gemini Live connection:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err?.message || 'Failed to initialize Live API session' }));
      clientWs.close();
    }
  }
});

// Handle WebSocket upgrade on /api/live
server.on('upgrade', (request, socket, head) => {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url || '', `http://${request.headers.host}`);
  } catch {
    socket.destroy();
    return;
  }
  const origin = request.headers.origin;
  let originUrl: URL | null = null;
  try {
    originUrl = origin ? new URL(origin) : null;
  } catch {
    originUrl = null;
  }
  const forwardedProto = request.headers['x-forwarded-proto'];
  const expectedProtocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0]?.trim() || 'http';
  if (
    requestUrl.pathname !== '/api/live' ||
    !originUrl ||
    originUrl.host !== request.headers.host ||
    originUrl.protocol !== `${expectedProtocol}:`
  ) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function getTargetPort(): number {
    const portArgIdx = process.argv.indexOf('--port');
    if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
      return parseInt(process.argv[portArgIdx + 1], 10);
    }
    // Dev server must always bind to port 3000 where nginx reverse-proxies traffic
    if (process.env.NODE_ENV !== 'production') {
      return 3000;
    }
    if (process.env.PORT && process.env.PORT !== '8080') {
      return parseInt(process.env.PORT, 10);
    }
    return 3000;
  }

  function getTargetHost(): string {
    const hostArgIdx = process.argv.indexOf('--host');
    if (hostArgIdx !== -1 && process.argv[hostArgIdx + 1]) {
      return process.argv[hostArgIdx + 1];
    }
    return '0.0.0.0';
  }

  const PORT = getTargetPort();
  const HOST = getTargetHost();

  server.on('error', (err: any) => {
    console.error(`Server error on ${HOST}:${PORT}:`, err);
  });

  server.listen(PORT, HOST, () => {
    console.log(`NEXUS SCM Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
