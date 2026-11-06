import type { ZodType } from 'zod';

export interface CompleteArgs<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
}

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

type Provider = (system: string, user: string, signal: AbortSignal) => Promise<string>;

const gemini: Provider = async (system, user, signal) => {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmError('LLM_API_KEY not configured');
  const model = process.env.LLM_MODEL || 'gemini-3.1-flash-lite';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    },
  );
  if (!res.ok) throw new LlmError(`gemini ${res.status}`, res.status);
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw new LlmError('empty gemini response');
  return text;
};

const anthropic: Provider = async (system, user, signal) => {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmError('LLM_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-haiku-5-5',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new LlmError(`anthropic ${res.status}`, res.status);
  const j = await res.json();
  return j?.content?.[0]?.text ?? '';
};

const PROVIDERS: Record<string, Provider> = { gemini, anthropic };

const stripFence = (s: string) => s.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

/** 15s timeout per try; one retry, plus backoff retries (max 3 tries) on 429/5xx. Zod-validated JSON; throws -> caller falls back. */
export async function complete<T>({ system, user, schema }: CompleteArgs<T>): Promise<T> {
  const provider = PROVIDERS[process.env.LLM_PROVIDER || 'gemini'];
  if (!provider) throw new LlmError('unknown LLM_PROVIDER');
  const timeout = Number(process.env.AI_TIMEOUT_MS || 15000);
  let last: unknown;
  let tries = 2;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const raw = await provider(system, user, ctl.signal);
      return schema.parse(JSON.parse(stripFence(raw)));
    } catch (e) {
      last = e;
      if (e instanceof LlmError && (e.status === 429 || (e.status ?? 0) >= 500)) {
        tries = 3;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
      if (e instanceof LlmError && e.message.includes('not configured')) break;
    } finally {
      clearTimeout(t);
    }
  }
  throw last instanceof Error ? last : new LlmError('llm failed');
}
