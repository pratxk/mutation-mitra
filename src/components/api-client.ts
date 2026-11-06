export interface Res<T> { ok: boolean; data?: T; error?: string; message_hi?: string }

export async function post<T = unknown>(url: string, body: unknown): Promise<Res<T>> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as Res<T>;
  } catch {
    return { ok: false, error: 'network', message_hi: 'नेटवर्क उपलब्ध नहीं।' };
  }
}
