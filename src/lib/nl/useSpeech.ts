"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Web Speech API (nl-logging.md, Phase 3). It's a browser interface, not a model: Chrome/Android use
// Google's recogniser, every iPhone browser uses Apple's (WebKit). Firefox has none. Voice only FILLS
// the search box; everything after that is the same pipeline as typing.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;
type SpeechRecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };

const ctor = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone permission is off. Allow it in the browser, or just type.",
  "service-not-allowed": "Voice isn't available in this browser. Type instead.",
  "audio-capture": "No microphone found. Type instead.",
  network: "Voice needs an internet connection. Type instead.",
  "no-speech": "Didn't hear anything. Tap the mic and speak.",
  "language-not-supported": "This browser can't recognise English (India). Type instead.",
};

/**
 * `supported` is false (and the mic hidden) when the browser has no SpeechRecognition.
 * onInterim streams live text into the box; onFinal fires once with the final sentence.
 */
export function useSpeech({ onInterim, onFinal, onError }: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}) {
  const supported = useSyncExternalStore(() => () => {}, () => Boolean(ctor()), () => false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const handlers = useRef({ onInterim, onFinal, onError });
  useEffect(() => {
    handlers.current = { onInterim, onFinal, onError };
  });

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "en-IN"; // Indian English copes with Hinglish food words better than en-US
    r.interimResults = true;
    r.continuous = false; // one utterance, then stop
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      handlers.current.onInterim((finalText + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") handlers.current.onError(MESSAGES[e.error] ?? "Voice stopped. Type instead.");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      if (finalText.trim()) handlers.current.onFinal(finalText.trim());
    };
    rec.current = r;
    try {
      r.start(); // must run inside the tap handler (mic permission needs a user gesture + HTTPS)
      setListening(true);
    } catch {
      rec.current = null;
      handlers.current.onError("Couldn't start the microphone. Type instead.");
    }
  }, []);

  // stop listening if the sheet closes mid-sentence
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, start, stop };
}
