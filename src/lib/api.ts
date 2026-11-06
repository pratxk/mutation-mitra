import { NextResponse } from 'next/server';
import { admin, userClient } from './supabase/server';
import type { Role } from './workflow/states';

export interface Profile {
  id: string;
  name: string;
  name_hi: string | null;
  role: Role;
  tehsil: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message_hi?: string;
}

export const ok = <T>(data: T) => NextResponse.json({ ok: true, data } satisfies ApiResult<T>);
export const fail = (status: number, error: string, message_hi: string) =>
  NextResponse.json({ ok: false, error, message_hi } satisfies ApiResult<never>, { status });

export async function currentProfile(): Promise<Profile | null> {
  const { data } = await userClient().auth.getUser();
  if (!data.user) return null;
  const { data: p } = await admin().from('profiles').select('*').eq('id', data.user.id).single();
  return (p as Profile) ?? null;
}
