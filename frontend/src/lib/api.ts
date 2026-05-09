import { supabase } from '@/integrations/supabase/client';

const DEFAULT_FASTAPI_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://cns-c1-1.onrender.com';

const FASTAPI_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_FASTAPI_URL as string | undefined) ??
  DEFAULT_FASTAPI_URL;

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface EmbedResult {
  embedding: number[];
  dim: number;
}

export async function embedFace(image: Blob): Promise<EmbedResult> {
  const fd = new FormData();
  fd.append('image', image, 'frame.jpg');
  const r = await fetch(`${FASTAPI_URL}/embed`, {
    method: 'POST',
    body: fd,
    headers: await authHeaders(),
  });
  if (!r.ok) throw new Error(`embed failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export interface RecognizeResult {
  ok: boolean;
  reason?: 'no_face' | 'spoof' | 'unknown';
  student_id?: string;
  confidence?: number;
  is_live: boolean;
  live_conf: number;
  liveness_breakdown?: Record<string, number>;
}

export async function recognizeFace(
  image: Blob,
  params: { session_id: string; group_id: string },
): Promise<RecognizeResult> {
  const fd = new FormData();
  fd.append('image', image, 'frame.jpg');
  fd.append('session_id', params.session_id);
  fd.append('group_id', params.group_id);
  const r = await fetch(`${FASTAPI_URL}/recognize`, {
    method: 'POST',
    body: fd,
    headers: await authHeaders(),
  });
  if (!r.ok) throw new Error(`recognize failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export interface CreateSessionPayload {
  module_id: string;
  group_id: string;
  session_date: string;
  start_time: string;
  session_type: 'lecture' | 'td' | 'tp' | 'exam';
  week: number;
}

export async function createSession(payload: CreateSessionPayload): Promise<void> {
  const r = await fetch(`${FASTAPI_URL}/sessions`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`create session failed: ${r.status} ${await r.text()}`);
}

export interface BackendHealth {
  ok: boolean;
  ts: number;
  face_service: { mock: boolean; loaded: boolean; error: string | null };
  anti_spoofing: { mock: boolean; mode: string; loaded: boolean; error: string | null; threshold: number };
}

export async function backendHealth(): Promise<BackendHealth> {
  const r = await fetch(`${FASTAPI_URL}/healthz`);
  if (!r.ok) throw new Error(`healthz failed: ${r.status}`);
  return r.json();
}
