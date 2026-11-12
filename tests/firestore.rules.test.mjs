import { after, before, beforeEach, describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'sap-security-rules-test';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || 8080),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv?.cleanup());

const verified = { uid: 'operator-1', token: { email: 'operator@example.com', email_verified: true } };
const unverified = { uid: 'operator-2', token: { email: 'operator@example.com', email_verified: false } };

describe('Firestore security rules', () => {
  it('allows a verified user to create and read only their own profile', async () => {
    const db = testEnv.authenticatedContext(verified.uid, verified.token).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/operator-1'), {
      email: 'operator@example.com', name: null, createdAt: Date.now(),
    }));
    await assertSucceeds(getDoc(doc(db, 'users/operator-1')));
    await assertFails(getDoc(doc(db, 'users/operator-2')));
  });

  it('rejects unverified users and profile field injection', async () => {
    const db = testEnv.authenticatedContext(unverified.uid, unverified.token).firestore();
    await assertFails(setDoc(doc(db, 'users/operator-2'), { email: 'operator@example.com' }));
    const verifiedDb = testEnv.authenticatedContext(verified.uid, verified.token).firestore();
    await assertFails(setDoc(doc(verifiedDb, 'users/operator-1'), {
      email: 'operator@example.com', role: 'admin',
    }));
  });

  it('allows a verified owner to create and read a valid archive', async () => {
    const db = testEnv.authenticatedContext(verified.uid, verified.token).firestore();
    const archive = {
      title: 'Inbound delivery failure', problem: 'GR posting failed',
      analysis: 'Stock synchronization issue', userId: verified.uid, timestamp: Date.now(),
    };
    await assertSucceeds(setDoc(doc(db, 'archives/a1'), archive));
    await assertSucceeds(getDoc(doc(db, 'archives/a1')));
  });

  it('rejects cross-user archives and unexpected archive fields', async () => {
    const db = testEnv.authenticatedContext(verified.uid, verified.token).firestore();
    await assertFails(setDoc(doc(db, 'archives/a2'), {
      title: 'x', problem: 'y', analysis: 'z', userId: 'another-user', timestamp: Date.now(),
    }));
    await assertFails(setDoc(doc(db, 'archives/a3'), {
      title: 'x', problem: 'y', analysis: 'z', userId: verified.uid, timestamp: Date.now(), admin: true,
    }));
  });

  it('allows valid telemetry and rejects spoofed ownership or invalid status', async () => {
    const db = testEnv.authenticatedContext(verified.uid, verified.token).firestore();
    const record = {
      userId: verified.uid, timestamp: Date.now(), latencyMs: 100,
      queryType: 'SAP Issue Analysis', queryLength: 50, responseLength: 500, status: 'SUCCESS',
    };
    await assertSucceeds(setDoc(doc(db, 'telemetry/t1'), record));
    await assertFails(setDoc(doc(db, 'telemetry/t2'), { ...record, userId: 'other-user' }));
    await assertFails(setDoc(doc(db, 'telemetry/t3'), { ...record, status: 'UNKNOWN' }));
  });
});
