const DEV = '०१२३४५६७८९';
export const toAsciiDigits = (s: string) => s.replace(/[०-९]/g, (c) => String(DEV.indexOf(c)));

/** "गाटा 123/क" vs "१२३ क" -> same key. */
export const normGata = (s: string) => toAsciiDigits(s).replace(/[^0-9A-Za-zऀ-ॿ]/g, '').toLowerCase();
