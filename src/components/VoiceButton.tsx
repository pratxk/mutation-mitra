'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Rec { lang: string; continuous: boolean; interimResults: boolean; onresult: (e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void; onend: () => void; start(): void; stop(): void }

/** Progressive enhancement: renders nothing-but-hint when Web Speech API is missing. */
export function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const t = useTranslations('step2');
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Rec | null>(null);
  const latest = useRef(onText);
  latest.current = onText; // recognition handler is bound once; always call the newest callback

  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const r = new Ctor();
    r.lang = 'hi-IN'; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) latest.current(last[0].transcript);
    };
    r.onend = () => setOn(false);
    rec.current = r;
    return () => r.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return <p className="text-sm text-stone-600">{t('micUnsupported')}</p>;
  return (
    <button type="button" className={`btn h-16 w-full text-lg ${on ? 'bg-red-700 text-white' : 'btn-ghost'}`}
      onClick={() => { if (on) rec.current?.stop(); else { rec.current?.start(); setOn(true); } }}>
      🎤 {on ? t('micStop') : t('mic')}
    </button>
  );
}
