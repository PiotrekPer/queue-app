import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Party, Tab, TabItem } from '../types';

const PARTIES_COL = 'parties';

function partyRef(id: string) {
  return doc(db, PARTIES_COL, id);
}

async function nextTicketNumber(): Promise<number> {
  const counterRef = doc(db, 'meta', 'ticketCounter');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    return next;
  });
}

export function subscribeToParties(
  callback: (parties: Party[]) => void
): () => void {
  const q = query(collection(db, PARTIES_COL), orderBy('joinedAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Party)
    );
  });
}

export async function addParty(
  name: string,
  partySize: number,
  phone: string
): Promise<Party> {
  const ticketNumber = await nextTicketNumber();
  const party: Omit<Party, 'id'> = {
    ticketNumber,
    name,
    partySize,
    phone,
    status: 'waiting',
    joinedAt: Date.now(),
  };
  const ref = await addDoc(collection(db, PARTIES_COL), party);
  return { id: ref.id, ...party };
}

export function callParty(id: string) {
  return updateDoc(partyRef(id), { status: 'called', calledAt: Date.now() });
}

export function seatParty(id: string) {
  return updateDoc(partyRef(id), { status: 'seated', seatedAt: Date.now() });
}

export function cancelParty(id: string) {
  return updateDoc(partyRef(id), { status: 'cancelled' });
}

export function removeParty(id: string) {
  return deleteDoc(partyRef(id));
}

export function clearTable(id: string) {
  return removeParty(id);
}

export function openTab(party: Party) {
  if (party.tab) return Promise.resolve();
  const tab: Tab = { open: true, items: [] };
  return updateDoc(partyRef(party.id), { tab });
}

export function addTabItem(party: Party, name: string, price: number) {
  const item: TabItem = {
    id: crypto.randomUUID(),
    name,
    price,
    addedAt: Date.now(),
  };
  const tab: Tab = party.tab ?? { open: true, items: [] };
  const newTab: Tab = { open: true, items: [...tab.items, item] };
  return updateDoc(partyRef(party.id), { tab: newTab });
}

export function removeTabItem(party: Party, itemId: string) {
  if (!party.tab) return Promise.resolve();
  const newTab: Tab = {
    ...party.tab,
    items: party.tab.items.filter((i) => i.id !== itemId),
  };
  return updateDoc(partyRef(party.id), { tab: newTab });
}

export function closeTab(party: Party) {
  if (!party.tab) return Promise.resolve();
  return updateDoc(partyRef(party.id), { tab: { ...party.tab, open: false } });
}

export function tabTotal(party: Party): number {
  return party.tab?.items.reduce((sum, i) => sum + i.price, 0) ?? 0;
}

export function findByTicketNumber(
  parties: Party[],
  ticketNumber: number
): Party | undefined {
  return parties.find((p) => p.ticketNumber === ticketNumber);
}

export function waitingAheadOf(parties: Party[], party: Party): number {
  return parties.filter(
    (p) => p.status === 'waiting' && p.joinedAt < party.joinedAt
  ).length;
}
