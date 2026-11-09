"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mic, RotateCcw, Sparkles, Square, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";
type Stage = "idle" | "requesting" | "recording" | "processing" | "transcribed" | "error";
type SpeechResult = { isFinal: boolean; 0?: { transcript: string } };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VoiceWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
};

const text = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);
const BAR_COUNT = 48;

export const DEMO_TRANSCRIPTS = {
  leak: {
    ar: "يوجد تسرب مياه واضح أسفل حوض التحضير في المطبخ، يرجى إرسال فني سباكة بأقرب وقت.",
    en: "There is an active water leak under the kitchen prep sink, please send a plumbing technician as soon as possible.",
  },
  ac: {
    ar: "المكيف في صالة العملاء لا يبرد ويصدر صوتاً مزعجاً، ودرجة حرارة الصالة مرتفعة.",
    en: "The AC in the customer hall is not cooling and making noise, the room temperature is rising.",
  },
  default: {
    ar: "يوجد تسرب مياه أسفل حوض التحضير في المطبخ.",
    en: "There is a water leak under the kitchen prep sink.",
  },
};

export interface AiVoiceInputModalProps {
  lang: Lang;
  onTranscript: (transcript: string) => void;
  onManualEntry?: () => void;
  className?: string;
}

export function AiVoiceInput({
  lang,
  onTranscript,
  onManualEntry,
  className,
}: AiVoiceInputModalProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(6));
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const finalizeTimeoutRef = useRef<number | null>(null);
  const transcriptPartsRef = useRef<Map<number, string>>(new Map());
  const onTranscriptRef = useRef(onTranscript);
  const cancelledRef = useRef(false);
  const finalizedRef = useRef(false);
  const recorderEndedRef = useRef(true);
  const speechEndedRef = useRef(true);
  const speechFailedRef = useRef(false);
  const startedAtRef = useRef(0);
  const processingStartedAtRef = useRef(0);
  const finalizeRef = useRef<() => void>(() => undefined);

  onTranscriptRef.current = onTranscript;

  const releaseResources = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (finalizeTimeoutRef.current !== null) {
      window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* noop */
        }
      });
      streamRef.current = null;
    }
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      try {
        void context.close();
      } catch {
        /* noop */
      }
    }
    recorderRef.current = null;
    recognitionRef.current = null;
  }, []);

  const finalize = useCallback(() => {
    if (
      cancelledRef.current ||
      finalizedRef.current ||
      !recorderEndedRef.current ||
      !speechEndedRef.current
    ) {
      return;
    }

    const elapsedProcessing = Date.now() - processingStartedAtRef.current;
    const remainingProcessingTime = 600 - elapsedProcessing;
    if (processingStartedAtRef.current && remainingProcessingTime > 0) {
      if (finalizeTimeoutRef.current !== null) window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = window.setTimeout(
        () => finalizeRef.current(),
        remainingProcessingTime,
      );
      return;
    }

    finalizedRef.current = true;
    const transcript = [...transcriptPartsRef.current.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, phrase]) => phrase.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    const speechFailed = speechFailedRef.current;
    releaseResources();

    if (transcript) {
      setTranscribedText(transcript);
      setStage("transcribed");
      setError("");
      setShowDemo(false);
      // Auto-deliver after brief confirmation view
      window.setTimeout(() => {
        onTranscriptRef.current(transcript);
        setOpen(false);
        setStage("idle");
      }, 700);
    } else {
      setStage("error");
      setShowDemo(true);
      setError(
        speechFailed
          ? text(
              lang,
              "لم يتوفر تفريغ صوتي من المتصفح. يمكنك إدراج المثال التجريبي أو كتابة الوصف.",
              "Browser transcription was unavailable. Use the demo example or type your description.",
            )
          : text(
              lang,
              "لم يُلتقط أي كلام واضح. يمكنك إعادة التسجيل أو استخدام المثال التجريبي.",
              "No clear speech was captured. Try recording again or insert the demo example.",
            ),
      );
    }
  }, [lang, releaseResources]);

  finalizeRef.current = finalize;

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
    }
    releaseResources();
    transcriptPartsRef.current.clear();
    finalizedRef.current = false;
    setSeconds(0);
    setError("");
    setShowDemo(false);
    setStage("idle");
    setOpen(false);
  }, [releaseResources]);

  const start = useCallback(async () => {
    if (stage === "requesting" || stage === "recording" || stage === "processing") return;
    cancelledRef.current = false;
    finalizedRef.current = false;
    speechFailedRef.current = false;
    transcriptPartsRef.current.clear();
    setSeconds(0);
    setBars(Array(BAR_COUNT).fill(6));
    setError("");
    setShowDemo(false);
    setTranscribedText("");
    setOpen(true);
    setStage("requesting");

    const browser = window as VoiceWindow;
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStage("error");
      setError(
        text(
          lang,
          "هذا المتصفح لا يتيح الوصول للميكروفون. يرجى تفعيل الصلاحية.",
          "This browser does not provide microphone access.",
        ),
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const Recorder = window.MediaRecorder;
      if (Recorder) {
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
          Recorder.isTypeSupported(type),
        );
        const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorderEndedRef.current = false;
        recorder.ondataavailable = () => undefined;
        recorder.onstop = () => {
          recorderEndedRef.current = true;
          finalizeRef.current();
        };
        recorder.onerror = () =>
          setError(
            text(
              lang,
              "تعذر التقاط الصوت، أعد المحاولة.",
              "Audio capture failed, please try again.",
            ),
          );
        recorder.start(250);
      } else {
        recorderEndedRef.current = true;
      }

      if (Recognition) {
        try {
          const recognition = new Recognition();
          recognitionRef.current = recognition;
          recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
          recognition.continuous = true;
          recognition.interimResults = false;
          speechEndedRef.current = false;
          recognition.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              const result = event.results[index];
              const phrase = result?.[0]?.transcript?.trim();
              if (result?.isFinal && phrase) transcriptPartsRef.current.set(index, phrase);
            }
          };
          recognition.onerror = (event) => {
            if (event.error !== "aborted" && !cancelledRef.current) speechFailedRef.current = true;
          };
          recognition.onend = () => {
            speechEndedRef.current = true;
            finalizeRef.current();
          };
          recognition.start();
        } catch {
          speechEndedRef.current = true;
          speechFailedRef.current = true;
        }
      } else {
        speechEndedRef.current = true;
        speechFailedRef.current = true;
      }

      const AudioContextConstructor = window.AudioContext || browser.webkitAudioContext;
      if (AudioContextConstructor) {
        try {
          const context = new AudioContextConstructor();
          audioContextRef.current = context;
          if (context.state === "suspended") await context.resume();
          const analyser = context.createAnalyser();
          analyser.fftSize = 128;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples = new Uint8Array(analyser.frequencyBinCount);

          const draw = () => {
            if (cancelledRef.current || finalizedRef.current) return;
            analyser.getByteFrequencyData(samples);
            setBars(
              Array.from({ length: BAR_COUNT }, (_, index) => {
                const sampleIndex = Math.floor((index * samples.length) / BAR_COUNT);
                const rawValue = samples[sampleIndex] ?? 0;
                // Scale value between 4px and 44px with a nice curve
                const normalized = Math.min(1, rawValue / 180);
                return Math.max(6, Math.round(normalized * 44));
              }),
            );
            rafRef.current = requestAnimationFrame(draw);
          };
          rafRef.current = requestAnimationFrame(draw);
        } catch {
          // Audio visualizer fallback: subtle animated pulse
        }
      }

      if (cancelledRef.current) {
        releaseResources();
        return;
      }

      startedAtRef.current = Date.now();
      setStage("recording");
      intervalRef.current = window.setInterval(
        () => setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)),
        250,
      );
    } catch (cause) {
      const denied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError");
      releaseResources();
      setStage("error");
      setError(
        denied
          ? text(
              lang,
              "لم يُسمح باستخدام الميكروفون. يمكنك السماح بالوصول أو كتابة الوصف يدوياً.",
              "Microphone access denied. Please grant permission or type your description.",
            )
          : text(
              lang,
              "تعذر بدء التسجيل. تحقق من الميكروفون وحاول مرة أخرى.",
              "Could not start recording. Check your microphone and retry.",
            ),
      );
    }
  }, [lang, releaseResources, stage]);

  const stop = () => {
    if (stage !== "recording") return;
    processingStartedAtRef.current = Date.now();
    setStage("processing");

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const recorder = recorderRef.current;
    const recognition = recognitionRef.current;
    recorderEndedRef.current = !recorder || recorder.state === "inactive";
    speechEndedRef.current = !recognition;

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        recorderEndedRef.current = true;
      }
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        speechEndedRef.current = true;
      }
    }

    finalizeTimeoutRef.current = window.setTimeout(() => {
      if (recorderRef.current?.state !== "inactive") {
        try {
          recorderRef.current?.stop();
        } catch {
          recorderEndedRef.current = true;
        }
      }
      recorderEndedRef.current = true;
      speechEndedRef.current = true;
      finalizeRef.current();
    }, 2200);

    finalizeRef.current();
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        try {
          recorder.stop();
        } catch {
          /* noop */
        }
      }
      releaseResources();
    };
  }, [releaseResources]);

  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const isRecording = stage === "recording";

  const handleOpenChange = (next: boolean) => {
    if (!next && (stage === "recording" || stage === "requesting" || stage === "processing")) {
      cancel();
    } else {
      setOpen(next);
    }
  };

  const handleUseDemo = (demoKey: keyof typeof DEMO_TRANSCRIPTS = "default") => {
    const textToInsert = DEMO_TRANSCRIPTS[demoKey][lang];
    onTranscriptRef.current(textToInsert);
    setOpen(false);
    setStage("idle");
    setError("");
    setShowDemo(false);
  };

  return (
    <div className={cn("ai-voice-input-wrapper", className)} data-testid="component-ai-voice-input">
      <button
        type="button"
        className="group relative inline-flex items-center gap-2 rounded-xl border border-[#c7d7e5] bg-[#e8f0f6] px-3.5 py-2 text-sm font-semibold text-[#1F3363] transition-colors duration-200 hover:border-[#91afc6] hover:bg-[#dce9f2] dark:border-[#3c536d] dark:bg-[#263d54] dark:text-[#dceaf4] dark:hover:bg-[#304b67]"
        onClick={() => void start()}
        aria-label={text(lang, "تسجيل وصف صوتي", "Record a voice description")}
        data-testid="button-start-voice"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#1F3363] via-[#2a4580] to-[#3a62aa] text-[#56F4EF] shadow-inner transition-transform group-hover:scale-105">
          <Mic className="h-4 w-4" />
        </span>
        <span>{text(lang, "تسجيل صوتي", "Record voice")}</span>
      </button>

      {onManualEntry && (
        <button
          type="button"
          className="mr-2 inline-flex text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
          onClick={onManualEntry}
        >
          {text(lang, "أو اكتب النص", "Or type description")}
        </button>
      )}

      {showDemo && !open && (
        <div
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-slate-800 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
          data-testid="status-voice-demo"
        >
          <div className="mb-2 font-medium text-amber-900 dark:text-amber-200">{error}</div>
          <p className="mb-2.5 rounded bg-white/70 p-2 italic dark:bg-slate-900/50">
            «{DEMO_TRANSCRIPTS.default[lang]}»
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F3363] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#2b4480]"
            onClick={() => handleUseDemo("default")}
            data-testid="button-use-demo-transcript"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#56F4EF]" />
            {text(lang, "إدراج النص التجريبي في البلاغ", "Insert demo text")}
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-white via-slate-50 to-[#56F4EF]/5 p-6 shadow-2xl backdrop-blur sm:max-w-md dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-[#1F3363]/40 dark:text-slate-100"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <DialogHeader className="items-center text-center sm:text-center [&_h2]:text-center [&_p]:text-center">
            <div className="mx-auto mb-1 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider text-[#307190] dark:text-[#56F4EF]">
              <Sparkles className="h-3.5 w-3.5 text-[#56F4EF]" />
              {text(lang, "تفريغ صوتي بالذكاء الاصطناعي", "AI VOICE NOTE")}
            </div>
            <DialogTitle className="w-full text-center font-serif text-2xl font-bold text-[#1F3363] dark:text-white">
              {text(lang, "صف المشكلة بصوتك", "Describe the issue aloud")}
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-[380px] text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
              {text(
                lang,
                "تحدّث بحرية عن العطل ومكانه؛ سيقوم تدارك بتحويل صوتك إلى بلاغ مكتوب.",
                "Speak freely about the issue; Tadaruk will transcribe it into your ticket.",
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Central Recording Visualizer Stage */}
          <div className="tadaruk-voice-stage relative my-3 flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/50">
            {/* Pulsing Central Mic Orb */}
            <div className="relative mb-3 flex items-center justify-center">
              {isRecording && (
                <>
                  <div
                    className="absolute h-20 w-20 rounded-full bg-[#456e91]/10 animate-ping"
                    style={{ animationDuration: "2s" }}
                  />
                  <div
                    className="absolute h-[72px] w-[72px] rounded-full border border-[#688eaa]/25 animate-pulse"
                    style={{ animationDuration: "1.4s" }}
                  />
                </>
              )}
              <button
                type="button"
                onClick={isRecording ? stop : () => void start()}
                className={cn(
                  "relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl transition-all duration-300",
                  isRecording
                    ? "tadaruk-voice-active-square text-[#56F4EF]"
                    : stage === "processing"
                      ? "bg-[#1F3363] text-[#56F4EF]"
                      : "bg-[#1F3363] text-white hover:scale-105 hover:bg-[#28487d]",
                )}
                aria-label={isRecording ? text(lang, "إيقاف التسجيل", "Stop recording") : text(lang, "بدء التسجيل", "Start recording")}
              >
                {stage === "processing" ? (
                  <LoaderCircle className="h-7 w-7 animate-spin text-[#56F4EF]" />
                ) : stage === "transcribed" ? (
                  <Check className="h-7 w-7 text-[#56F4EF]" />
                ) : isRecording ? null : (
                  <Mic className="h-7 w-7" />
                )}
              </button>
            </div>

            {/* Waveform Visualizer Bars */}
            <div
              className="tadaruk-voice-waveform flex h-10 w-full max-w-xs items-center justify-center gap-[3px] px-2"
              role="img"
              aria-label={text(lang, "موجة مستوى الصوت", "Audio waveform")}
            >
              {bars.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-[3px] rounded-full transition-[height,background-color] duration-100",
                    isRecording
                      ? "bg-[#426a8d] dark:bg-[#9ebbd0]"
                      : "bg-slate-300/80 dark:bg-slate-600/70",
                  )}
                  style={{
                    height: isRecording ? `${height}px` : "6px",
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-3.5 py-1 text-xs font-mono font-bold tracking-wider text-[#1F3363] shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-cyan-300">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-400",
                )}
              />
              <span role="timer">{formattedTime}</span>
            </div>

            {/* Dynamic Status Label */}
            <div className="mt-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
              {stage === "requesting" && text(lang, "بانتظار إذن الميكروفون...", "Requesting mic permission...")}
              {stage === "recording" && (
                <span className="text-[#1F3363] dark:text-[#56F4EF]">
                  {text(lang, "جارٍ الاستماع... تحدث بوضوح", "Listening... Speak clearly")}
                </span>
              )}
              {stage === "processing" && (
                <span className="inline-flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  {text(lang, "جارٍ تحويل الصوت إلى نص منظم...", "Converting speech to text...")}
                </span>
              )}
              {stage === "transcribed" && (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  {text(lang, "تم التفريغ بنجاح!", "Transcription ready!")}
                </span>
              )}
              {stage === "error" && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
            </div>
          </div>

          {/* Fallback demo selection when recognition fails or for quick test */}
          {stage === "error" && (
            <div className="mb-3 rounded-xl border border-cyan-500/20 bg-cyan-50/70 p-3 text-xs dark:bg-cyan-950/20">
              <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
                {text(lang, "اختر سيناريو تجريبي فوري:", "Select a demo scenario:")}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => handleUseDemo("leak")}
                  className="rounded-lg border border-cyan-400/40 bg-white p-2 text-start text-xs font-medium text-slate-800 shadow-sm hover:border-cyan-500 hover:bg-cyan-50 dark:bg-slate-800 dark:text-cyan-100"
                >
                  💧 {DEMO_TRANSCRIPTS.leak[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => handleUseDemo("ac")}
                  className="rounded-lg border border-cyan-400/40 bg-white p-2 text-start text-xs font-medium text-slate-800 shadow-sm hover:border-cyan-500 hover:bg-cyan-50 dark:bg-slate-800 dark:text-cyan-100"
                >
                  ❄️ {DEMO_TRANSCRIPTS.ac[lang]}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3">
            {isRecording ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1F3363] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#2b4685]"
                data-testid="button-stop-voice"
              >
                <Square className="h-4 w-4 fill-current text-[#56F4EF]" />
                {text(lang, "إيقاف التسجيل وتفريغ النص", "Stop and transcribe")}
              </button>
            ) : stage === "error" ? (
              <button
                type="button"
                onClick={() => void start()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                data-testid="button-retry-voice"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {text(lang, "إعادة المحاولة", "Try again")}
              </button>
            ) : null}

            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              data-testid="button-cancel-voice"
            >
              <X className="h-3.5 w-3.5" />
              {text(lang, "إلغاء", "Cancel")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Standalone component compatibility for code supplied by the user
export interface AIVoiceInputProps {
  onStart?: () => void;
  onStop?: (duration: number) => void;
  visualizerBars?: number;
  demoMode?: boolean;
  demoInterval?: number;
  className?: string;
}

export function AIVoiceInput({
  onStart,
  onStop,
  visualizerBars = 48,
  demoMode = false,
  demoInterval = 3000,
  className,
}: AIVoiceInputProps) {
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isDemo, setIsDemo] = useState(demoMode);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (submitted) {
      onStart?.();
      intervalId = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      onStop?.(time);
      setTime(0);
    }

    return () => clearInterval(intervalId);
  }, [submitted, time, onStart, onStop]);

  useEffect(() => {
    if (!isDemo) return;

    let timeoutId: NodeJS.Timeout;
    const runAnimation = () => {
      setSubmitted(true);
      timeoutId = setTimeout(() => {
        setSubmitted(false);
        timeoutId = setTimeout(runAnimation, 1000);
      }, demoInterval);
    };

    const initialTimeout = setTimeout(runAnimation, 100);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialTimeout);
    };
  }, [isDemo, demoInterval]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = () => {
    if (isDemo) {
      setIsDemo(false);
      setSubmitted(false);
    } else {
      setSubmitted((prev) => !prev);
    }
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto flex max-w-xl w-full flex-col items-center gap-2">
        <button
          className={cn(
            "group flex h-16 w-16 items-center justify-center rounded-xl transition-colors",
            submitted ? "bg-none" : "bg-none hover:bg-black/10 dark:hover:bg-white/10",
          )}
          type="button"
          onClick={handleClick}
        >
          {submitted ? (
            <div
              className="pointer-events-auto h-6 w-6 cursor-pointer animate-spin rounded-sm bg-[#1F3363] dark:bg-[#56F4EF]"
              style={{ animationDuration: "3s" }}
            />
          ) : (
            <Mic className="h-6 w-6 text-black/70 dark:text-white/70" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            submitted ? "text-black/70 dark:text-white/70" : "text-black/30 dark:text-white/30",
          )}
        >
          {formatTime(time)}
        </span>

        <div className="flex h-4 w-64 items-center justify-center gap-0.5">
          {[...Array(visualizerBars)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                submitted
                  ? "animate-pulse bg-[#1F3363] dark:bg-[#56F4EF]"
                  : "h-1 bg-black/10 dark:bg-white/10",
              )}
              style={
                submitted && isClient
                  ? {
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-black/70 dark:text-white/70">
          {submitted ? "Listening..." : "Click to speak"}
        </p>
      </div>
    </div>
  );
}
