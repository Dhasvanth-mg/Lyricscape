'use client';

import { createContext, useContext } from 'react';
import type { PartySnapshot } from '@/lib/party/schemas';
import type { ApiError } from '@/lib/party/client';

export type PartyCtx = {
  slug: string;
  snap: PartySnapshot;
  refresh: () => Promise<void>;
  connected: boolean;
};

const Ctx = createContext<PartyCtx | null>(null);
export const PartyProvider = Ctx.Provider;

export function useParty(): PartyCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useParty must be used inside the party layout');
  return v;
}

export function describeError(e: ApiError): { title: string; body: string } {
  if (e.status === 404) return { title: 'Party not found', body: 'It may have been deleted, or this account is not a member. Ask the host for an invite link.' };
  if (e.status === 403 && e.code === 'banned') return { title: 'Removed from this party', body: 'The host removed you from this party.' };
  if (e.status === 0) return { title: 'Offline', body: e.message };
  return { title: 'Something went wrong', body: e.message };
}
