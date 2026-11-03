import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, X } from "lucide-react";

type Lang = "ar" | "en";
type VoiceStage = "idle" | "requesting" | "recording" | "processing" | "ready" | "error";
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const text = (lang: Lang, ar: string, en: string) => lang === "ar" ? ar : en;
const initialBars = () => Array.from({ length: 24 }, () => 4);

export function AiVoiceInput({
  lang,
  onTranscript,
  onManualEntry,
}: {
  lang: Lang;
  onTranscript: (transcript: string) => void;
  onManualEntry?: () => void;
}) {
  const [stage, setStageState] = useState<VoiceStage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState(initialBars);
  const [error, setError] = useState("");
  const stageRef = useRef<VoiceStage>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef<Map<number, string>>(new Map());
  const recorderEndedRef = useRef(true);
  const recognitionEndedRef = useRef(true);
  const recognitionFailedRef = useRef(false);
  const cancelledRef = useRef(false);
  const finalizedRef = useRef(false);
  const mountedRef = useRef(true);
  const callbackRef = useRef(onTranscript);
  const finishRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  const setStage = (next: VoiceStage) => {
    stageRef.current = next;
    setStageState(next);
  };

  const clearTimers = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (finishTimeoutRef.current !== null) window.clearTimeout(finishTimeoutRef.current);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    intervalRef.current = null;
    finishTimeoutRef.current = null;
    animationRef.current = null;
  };

  const releaseTracksAndAudio = () => {
    clearTimers();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    recognitionRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  };

  finishRef.current = () => {
    if (cancelledRef.current || finalizedRef.current ||
        !recorderEndedRef.current || !recognitionEndedRef.current) return;
    finalizedRef.current = true;
    clearTimers();
    const transcript = [...transcriptRef.current.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, value]) => value)
      .join(" ")
      .trim();
    releaseTracksAndAudio();

    if (transcript) {
      callbackRef.current(transcript);
      setError("");
      setStage("ready");
    } else {
      setError(recognitionFailedRef.current
        ? text(lang, "التفريغ الصوتي غير متاح الآن. اكتب الوصف يدوياً أو حاول مرة أخرى.", "Speech transcription is unavailable right now. Type the description or try again.")
        : text(lang, "لم نلتقط كلمات واضحة. اكتب الوصف يدوياً أو حاول مرة أخرى.", "No clear words were captured. Type the description or try again."));
      setStage("error");
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* browser may already have stopped */ }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    releaseTracksAndAudio();
    transcriptRef.current.clear();
    finalizedRef.current = false;
    setError("");
    setSeconds(0);
    setBars(initialBars());
    setStage("idle");
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      try { recognitionRef.current?.abort(); } catch { /* no-op during unmount */ }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* no-op during unmount */ }
      }
      releaseTracksAndAudio();
    };
  }, []);

  const start = async () => {
    if (!["idle", "ready", "error"].includes(stageRef.current)) return;
    setError("");
    setSeconds(0);
    setBars(initialBars());
    cancelledRef.current = false;
    finalizedRef.current = false;
    recognitionFailedRef.current = false;
    transcriptRef.current.clear();
    chunksRef.current = [];

    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
      webkitAudioContext?: typeof AudioContext;
    };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    const MediaRecorderConstructor = window.MediaRecorder;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(text(lang, "هذا المتصفح لا يتيح الوصول إلى الميكروفون.", "This browser does not provide microphone access."));
      setStage("error");
      return;
    }
    if (!MediaRecorderConstructor && !Recognition) {
      setError(text(lang, "التسجيل والتفريغ غير متاحين في هذا المتصفح. اكتب الوصف يدوياً.", "Recording and transcription are unavailable in this browser. Type the description instead."));
      setStage("error");
      return;
    }

    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || cancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      if (MediaRecorderConstructor) {
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
          .find((type) => MediaRecorderConstructor.isTypeSupported(type));
        const recorder = new MediaRecorderConstructor(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorderEndedRef.current = false;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          recorderEndedRef.current = true;
          finishRef.current();
        };
        recorder.onerror = () => {
          setError(text(lang, "تعذر تسجيل الصوت. أوقف التسجيل واكتب الوصف يدوياً.", "Audio capture failed. Stop and type the description instead."));
        };
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
          recognitionEndedRef.current = false;
          recognition.onresult = (event) => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              const result = event.results[index];
              const transcript = result?.[0]?.transcript?.trim();
              if (result?.isFinal && transcript) transcriptRef.current.set(index, transcript);
            }
          };
          recognition.onerror = (event) => {
            if (event.error === "aborted" || cancelledRef.current) return;
            recognitionFailedRef.current = true;
            setError(text(lang, "تعذر تحويل الصوت إلى نص. يمكنك إيقاف التسجيل وكتابة الوصف.", "Speech could not be transcribed. You can stop and type the description."));
          };
          recognition.onend = () => {
            recognitionEndedRef.current = true;
            finishRef.current();
          };
          recognition.start();
        } catch {
          recognitionEndedRef.current = true;
          recognitionFailedRef.current = true;
        }
      } else {
        recognitionEndedRef.current = true;
      }

      const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
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
            if (stageRef.current !== "recording" || cancelledRef.current) return;
            analyser.getByteFrequencyData(samples);
            const nextBars = Array.from({ length: 24 }, (_, index) => {
              const sample = samples[Math.floor(index * samples.length / 24)] ?? 0;
              return Math.max(4, Math.min(28, Math.round(sample / 255 * 28)));
            });
            setBars(nextBars);
            animationRef.current = requestAnimationFrame(draw);
          };
          animationRef.current = requestAnimationFrame(draw);
        } catch {
          // Recording/transcription can continue without an analyser.
        }
      }

      if (!mountedRef.current || cancelledRef.current) {
        releaseTracksAndAudio();
        return;
      }
      setStage("recording");
      intervalRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      cancelledRef.current = true;
      try { recognitionRef.current?.abort(); } catch { /* browser may already have stopped */ }
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* already stopped */ }
      }
      setError(denied
        ? text(lang, "لم يُسمح باستخدام الميكروفون. يمكنك كتابة الوصف بدلاً من ذلك.", "Microphone access was not allowed. You can type the description instead.")
        : text(lang, "تعذر بدء التسجيل. تحقق من الميكروفون وحاول مرة أخرى.", "Could not start recording. Check the microphone and try again."));
      releaseTracksAndAudio();
      setStage("error");
    }
  };

  const stop = () => {
    if (stageRef.current !== "recording") return;
    setStage("processing");
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    intervalRef.current = null;
    animationRef.current = null;
    const recorder = recorderRef.current;
    const recognition = recognitionRef.current;
    recorderEndedRef.current = !recorder || recorder.state === "inactive";
    recognitionEndedRef.current = !recognition;

    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { recorderEndedRef.current = true; }
    }
    if (recognition) {
      try { recognition.stop(); } catch { recognitionEndedRef.current = true; }
    }

    finishTimeoutRef.current = window.setTimeout(() => {
      recognitionEndedRef.current = true;
      const activeRecorder = recorderRef.current;
      if (activeRecorder?.state !== "inactive") {
        try { activeRecorder?.stop(); } catch { /* already stopped */ }
      }
      recorderEndedRef.current = true;
      finishRef.current();
    }, 2500);
    finishRef.current();
  };

  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const isBusy = stage === "requesting" || stage === "processing";

  return (
    <div className="ai-voice-input" data-testid="component-ai-voice-input">
      <div className="ai-voice-controls">
        {(stage === "idle" || stage === "ready" || stage === "error") && (
          <button type="button" className="voice-button" onClick={() => void start()} data-testid="button-start-voice">
            {stage === "ready" ? <RotateCcw size={15} /> : <Mic size={15} />}
            {stage === "ready"
              ? text(lang, "تسجيل مرة أخرى", "Record again")
              : text(lang, "تسجيل وصف صوتي", "Record a voice description")}
          </button>
        )}
        {stage === "recording" && (
          <>
            <button type="button" className="voice-button voice-active" onClick={stop} data-testid="button-stop-voice">
              <Square size={14} fill="currentColor" />{text(lang, "إيقاف التسجيل", "Stop recording")}
            </button>
            <span className="voice-timer" role="timer" aria-label={formattedTime}>{formattedTime}</span>
            <button type="button" className="voice-cancel" onClick={cancel} data-testid="button-cancel-voice">
              <X size={14} />{text(lang, "إلغاء", "Cancel")}
            </button>
          </>
        )}
        {stage === "requesting" && <span className="voice-live-status" role="status">{text(lang, "بانتظار إذن الميكروفون…", "Waiting for microphone permission…")}</span>}
        {stage === "processing" && <span className="voice-live-status" role="status">{text(lang, "جارٍ إنهاء التسجيل…", "Finishing the recording…")}</span>}
      </div>
      {stage === "recording" && <div className="voice-wave" role="img" aria-label={text(lang, "مستوى الصوت المباشر", "Live audio level")}>
        {bars.map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}
      </div>}
      {stage === "recording" && <span className="voice-hint">{text(lang, "لا تحفظ تدارك التسجيل. قد يستخدم المتصفح خدمة التفريغ الصوتي التابعة له.", "TADARUK does not save the recording. Your browser may use its own speech service for transcription.")}</span>}
      {stage === "ready" && <span className="voice-success" role="status">{text(lang, "أُضيف النص إلى الوصف. راجعه قبل المتابعة.", "The transcript was added to the description. Review it before continuing.")}</span>}
      {isBusy && <span className="voice-wave voice-wave-busy" aria-hidden="true">{bars.map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}</span>}
      {error && <span className="voice-error" role="alert">{error}</span>}
      {stage === "error" && onManualEntry && (
        <button type="button" className="voice-manual-entry" onClick={onManualEntry}>
          {text(lang, "اكتب الوصف يدوياً", "Type the description")}
        </button>
      )}
    </div>
  );
}
