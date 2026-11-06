/** Mask 10+ digit runs (Aadhaar/phone-like) before text goes to the LLM. */
export const maskIds = (s: string) =>
  s.replace(/(?:[0-9०-९][\s-]?){10,}/g, (m) => '●'.repeat(Math.max(0, m.replace(/\D/g, '').length - 4)) + m.slice(-4));
