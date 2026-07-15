export type PartyStatus = 'waiting' | 'called' | 'seated' | 'cancelled';

export interface TabItem {
  id: string;
  name: string;
  price: number;
  addedAt: number;
}

export interface Tab {
  open: boolean;
  items: TabItem[];
}

export interface Party {
  id: string;
  ticketNumber: number;
  name: string;
  partySize: number;
  phone?: string;
  status: PartyStatus;
  joinedAt: number;
  calledAt?: number;
  seatedAt?: number;
  tab?: Tab;
}
