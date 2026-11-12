import { db, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export interface TelemetryRecord {
  id?: string;
  userId: string;
  timestamp: number;
  latencyMs: number;
  queryType: string; // 'SAP Issue Analysis' | 'OSS Note Search' | 'Specification Generation'
  queryLength: number;
  responseLength: number;
  status: 'SUCCESS' | 'FAILURE';
}

enum OperationType {
  CREATE = 'create',
  GET = 'get',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Telemetry Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Log telemetry record
export async function logTelemetry(
  queryType: string,
  queryLength: number,
  responseLength: number,
  latencyMs: number,
  status: 'SUCCESS' | 'FAILURE'
): Promise<TelemetryRecord | null> {
  const user = auth.currentUser;
  if (!user) {
    console.warn('Telemetry: No authenticated user. Skipping cloud log.');
    return null;
  }

  const record: TelemetryRecord = {
    userId: user.uid,
    timestamp: Date.now(),
    latencyMs,
    queryType,
    queryLength,
    responseLength,
    status,
  };

  try {
    const docRef = await addDoc(collection(db, 'telemetry'), record);
    return { ...record, id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'telemetry');
    return null;
  }
}

// Get telemetry records for current user
export async function getTelemetryRecords(): Promise<TelemetryRecord[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'telemetry'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TelemetryRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'telemetry');
    return [];
  }
}

// Generates beautiful realistic synthetic performance data to populate dashboard immediately
export function generateSyntheticTelemetry(userId: string): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  const queryTypes = [
    { type: 'SAP Issue Analysis', avgLatency: 2800, deviation: 800, qLenAvg: 400, rLenAvg: 5000 },
    { type: 'OSS Note Search', avgLatency: 1600, deviation: 400, qLenAvg: 120, rLenAvg: 1200 },
    { type: 'Specification Generation', avgLatency: 4800, deviation: 1200, qLenAvg: 600, rLenAvg: 12000 }
  ];

  const now = Date.now();
  
  // Create 24 hours of data points
  for (let i = 24; i >= 1; i--) {
    const hoursAgo = i;
    const timestamp = now - hoursAgo * 60 * 60 * 1000 - Math.random() * 15 * 60 * 1000;
    
    // 1-3 queries per hour
    const numQueries = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numQueries; j++) {
      const qMeta = queryTypes[Math.floor(Math.random() * queryTypes.length)];
      
      const latencyMs = Math.max(
        400, 
        Math.floor(qMeta.avgLatency + (Math.random() - 0.5) * qMeta.deviation * 2)
      );
      
      const status = Math.random() < 0.04 ? 'FAILURE' : 'SUCCESS'; // 4% error rate
      const actualLatency = status === 'FAILURE' ? Math.floor(latencyMs * 0.3) : latencyMs; // Failures are fast

      records.push({
        userId,
        timestamp,
        latencyMs: actualLatency,
        queryType: qMeta.type,
        queryLength: Math.floor(qMeta.qLenAvg * (0.8 + Math.random() * 0.4)),
        responseLength: status === 'FAILURE' ? 0 : Math.floor(qMeta.rLenAvg * (0.7 + Math.random() * 0.6)),
        status
      });
    }
  }

  // Sort by timestamp descending
  return records.sort((a, b) => b.timestamp - a.timestamp);
}
