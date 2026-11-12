/**
 * NEXUS SCM 2100 - Client-Side AI Operations Service
 * 
 * All Gemini model interactions, token streaming, and Live API WebSocket bridging
 * are securely proxied through the full-stack server-side endpoints (/api/gemini/*).
 * The client bundle does not import @google/genai or expose keys to the browser.
 */

export interface Attachment {
  type: string;
  data: string;
}

export interface OssNote {
  id: string;
  title: string;
  component: string;
  releasedOn: string;
  status: string;
  priority: string;
  category: string;
  shortText: string;
}

/**
 * Executes deep SAP operational error resolution via server-side Gemini 3.8 Flash
 */
export async function analyzeSapIssue(
  prompt: string,
  attachments?: Attachment[]
): Promise<string> {
  try {
    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        attachments,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Failed to analyze SAP issue via server:', error);
    throw new Error(error?.message || 'Failed to analyze the issue. Please check your network connection.');
  }
}

/**
 * Optional streaming version of analyzeSapIssue using Server-Sent Events
 */
export async function analyzeSapIssueStream(
  prompt: string,
  attachments?: Attachment[],
  onChunk?: (text: string) => void
): Promise<string> {
  try {
    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        attachments,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body stream is not readable');
    }

    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') {
            break;
          }
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              accumulatedText += parsed.text;
              if (onChunk) onChunk(parsed.text);
            }
          } catch {
            // Ignore non-json SSE lines
          }
        }
      }
    }

    return accumulatedText;
  } catch (error: any) {
    console.error('Streaming analyzeSapIssue error:', error);
    throw error;
  }
}

/**
 * Searches and scores SAP OSS Notes via server-side Gemini 3.8 Flash
 */
export async function searchOssNotes(prompt: string): Promise<OssNote[]> {
  try {
    const response = await fetch('/api/gemini/oss-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.notes) ? data.notes : [];
  } catch (error: any) {
    console.error('Failed to search OSS notes via server:', error);
    throw new Error('Failed to retrieve OSS notes. Please check your connection.');
  }
}

/**
 * Queries the Chart Metrics & Visual Intelligence Agent via server-side Gemini
 */
export async function askChartAgent(prompt: string, chartData: any): Promise<string> {
  try {
    const response = await fetch('/api/gemini/chart-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        chartData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.text || 'NO RESPONSE RECEIVED FROM THE QUANTUM MATRIX';
  } catch (error: any) {
    console.error('Failed to query Chart AI Agent via server:', error);
    throw new Error('Failed to communicate with Chart Intelligence Swarm.');
  }
}

/**
 * Generates Enterprise SCM Technical and Functional Specifications via server-side Gemini
 */
export async function generateSpecifications(
  docType: 'FSD' | 'TSD' | 'UAT' | 'ALL',
  requirement: string,
  extraParams?: {
    sapModules?: string[];
    author?: string;
    version?: string;
    criticality?: 'Low' | 'Medium' | 'High' | 'Emergency-Stop';
  }
): Promise<string> {
  try {
    const response = await fetch('/api/gemini/specifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docType,
        requirement,
        sapModules: extraParams?.sapModules,
        author: extraParams?.author,
        version: extraParams?.version,
        criticality: extraParams?.criticality,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data.text || 'FAILED TO INITIALIZE SPECIFICATION GENERATOR COGNITIVE ROUTINE.';
  } catch (error: any) {
    console.error('Failed to generate documentation specification via server:', error);
    throw new Error('Failed to compile specification file. Please check system configurations.');
  }
}

/**
 * Helper to establish a WebSocket session with the server's Gemini Live API bridge
 */
export function createLiveApiSocket(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${protocol}//${window.location.host}/api/live`;
  return new WebSocket(socketUrl);
}

export interface EwmCommunitySource {
  title: string;
  url: string;
  snippet?: string;
}

export interface EwmSolutionResult {
  solution: string;
  communitySources: EwmCommunitySource[];
  searchQueries?: string[];
  tcodes?: string[];
  ossNotes?: string[];
  communityHubUrl: string;
  timestamp: string;
}

export interface EwmPopularTopic {
  title: string;
  category: string;
  query: string;
  tcode: string;
}

export interface EwmCommunityHubInfo {
  hubUrl: string;
  portalName: string;
  topicId: string;
  popularTopics: EwmPopularTopic[];
}

/**
 * Searches the SAP EWM Community (grounded via community.sap.com) for solutions
 */
export async function findEwmCommunitySolution(params: {
  query?: string;
  url?: string;
  category?: string;
}): Promise<EwmSolutionResult> {
  try {
    const response = await fetch('/api/gemini/ewm-solutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Failed to query SAP EWM Community solutions via server:', error);
    throw new Error(error?.message || 'Failed to retrieve EWM solution from server.');
  }
}

/**
 * Retrieves the SAP EWM Community Topic Hub metadata and popular operational issues
 */
export async function getEwmCommunityHub(): Promise<EwmCommunityHubInfo> {
  try {
    const response = await fetch('/api/gemini/ewm-community/hub');
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('Failed to get EWM Community Hub metadata:', error);
    return {
      hubUrl: 'https://community.sap.com/t5/c-khhcw49343/SAP+Extended+Warehouse+Management/pd-p/01200615320800000705',
      portalName: 'SAP Extended Warehouse Management Community',
      topicId: '01200615320800000705',
      popularTopics: [],
    };
  }
}

