import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Mic2, RotateCcw, Square, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type Lang = 'ar' | 'en';
type Stage = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';
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

const text = (lang: Lang, ar: string, en: string) => lang === 'ar' ? ar : en;
const barCount = 34;
const demoTranscript = {
  ar: 'يوجد تسرب مياه أسفل حوض المطبخ.',
  en: 'There is a water leak under the kitchen sink.',
};

export function AiVoiceInput({
  lang,
  onTranscript,
  onManualEntry,
}: {
  lang: Lang;
  onTranscript: (transcript: string) => void;
  onManualEntry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(barCount).fill(3));
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);
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
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (finalizeTimeoutRef.current !== null) window.clearTimeout(finalizeTimeoutRef.current);
    intervalRef.current = null;
    rafRef.current = null;
    finalizeTimeoutRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
    recorderRef.current = null;
    recognitionRef.current = null;
  }, []);

  const finalize = useCallback(() => {
    if (cancelledRef.current || finalizedRef.current || !recorderEndedRef.current || !speechEndedRef.current) return;
    const remainingProcessingTime = 480 - (Date.now() - processingStartedAtRef.current);
    if (processingStartedAtRef.current && remainingProcessingTime > 0) {
      if (finalizeTimeoutRef.current !== null) window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = window.setTimeout(() => finalizeRef.current(), remainingProcessingTime);
      return;
    }
    finalizedRef.current = true;
    const transcript = [...transcriptPartsRef.current.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, phrase]) => phrase.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const speechFailed = speechFailedRef.current;
    releaseResources();
    if (transcript) {
      setOpen(false);
      setStage('idle');
      setError('');
      setShowDemo(false);
      onTranscriptRef.current(transcript);
    } else {
      setOpen(false);
      setStage('idle');
      setShowDemo(true);
      setError(speechFailed
        ? text(lang, 'لم يتوفر تفريغ صوتي من المتصفح. يمكنك استخدام المثال التجريبي أو كتابة الوصف.', 'Browser transcription was unavailable. Use the labeled demo sample or type your description.')
        : text(lang, 'لم يتوفر نص مسجل. يمكنك استخدام المثال التجريبي أو كتابة الوصف.', 'No transcript was available. Use the labeled demo sample or type your description.'));
    }
  }, [lang, releaseResources]);
  finalizeRef.current = finalize;

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* Recognition may already be closed. */ }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try { recorder.stop(); } catch { /* Recorder may already be closed. */ }
    }
    releaseResources();
    transcriptPartsRef.current.clear();
    finalizedRef.current = false;
    setSeconds(0);
    setError('');
    setShowDemo(false);
    setStage('idle');
    setOpen(false);
  }, [releaseResources]);

  const start = useCallback(async () => {
    if (stage === 'requesting' || stage === 'recording' || stage === 'processing') return;
    cancelledRef.current = false;
    finalizedRef.current = false;
    speechFailedRef.current = false;
    transcriptPartsRef.current.clear();
    setSeconds(0);
    setBars(Array(barCount).fill(3));
    setError('');
    setShowDemo(false);
    setOpen(true);
    setStage('requesting');

    const browser = window as VoiceWindow;
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStage('error');
      setError(text(lang, 'هذا المتصفح لا يتيح الوصول إلى الميكروفون. تحقق من إعدادات المتصفح.', 'This browser does not provide microphone access. Check your browser settings.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const Recorder = window.MediaRecorder;
      if (Recorder) {
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => Recorder.isTypeSupported(type));
        const recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorderEndedRef.current = false;
        recorder.ondataavailable = () => undefined;
        recorder.onstop = () => {
          recorderEndedRef.current = true;
          finalizeRef.current();
        };
        recorder.onerror = () => setError(text(lang, 'تعذر التقاط الصوت. يمكنك إيقاف التسجيل أو المحاولة مرة أخرى.', 'Audio capture failed. Stop recording or try again.'));
        recorder.start(250);
      } else {
        recorderEndedRef.current = true;
      }

      if (Recognition) {
        try {
          const recognition = new Recognition();
          recognitionRef.current = recognition;
          recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
          recognition.continuous = true;
          recognition.interimResults = false;
          speechEndedRef.current = false;
          recognition.onresult = event => {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
              const result = event.results[index];
              const phrase = result?.[0]?.transcript?.trim();
              if (result?.isFinal && phrase) transcriptPartsRef.current.set(index, phrase);
            }
          };
          recognition.onerror = event => {
            if (event.error !== 'aborted' && !cancelledRef.current) speechFailedRef.current = true;
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
          if (context.state === 'suspended') await context.resume();
          const analyser = context.createAnalyser();
          analyser.fftSize = 128;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples = new Uint8Array(analyser.frequencyBinCount);
          const draw = () => {
            if (cancelledRef.current || finalizedRef.current) return;
            analyser.getByteFrequencyData(samples);
            setBars(Array.from({ length: barCount }, (_, index) => {
              const value = samples[Math.floor(index * samples.length / barCount)] ?? 0;
              return Math.max(3, Math.min(38, Math.round(value / 255 * 38)));
            }));
            rafRef.current = requestAnimationFrame(draw);
          };
          rafRef.current = requestAnimationFrame(draw);
        } catch {
          // Capture remains usable when the browser does not expose an analyser.
        }
      }
      if (cancelledRef.current) {
        releaseResources();
        return;
      }
      startedAtRef.current = Date.now();
      setStage('recording');
      intervalRef.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    } catch (cause) {
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'PermissionDeniedError');
      releaseResources();
      setStage('error');
      setError(denied
        ? text(lang, 'لم يُسمح باستخدام الميكروفون. اسمح بالوصول أو اكتب الوصف يدوياً.', 'Microphone access was denied. Allow access or type your description.')
        : text(lang, 'تعذر بدء التسجيل. تحقق من الميكروفون وحاول مرة أخرى.', 'Could not start recording. Check the microphone and try again.'));
    }
  }, [lang, releaseResources, stage]);

  const stop = () => {
    if (stage !== 'recording') return;
    processingStartedAtRef.current = Date.now();
    setStage('processing');
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    intervalRef.current = null;
    rafRef.current = null;
    const recorder = recorderRef.current;
    const recognition = recognitionRef.current;
    recorderEndedRef.current = !recorder || recorder.state === 'inactive';
    speechEndedRef.current = !recognition;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { recorderEndedRef.current = true; }
    }
    if (recognition) {
      try { recognition.stop(); } catch { speechEndedRef.current = true; }
    }
    finalizeTimeoutRef.current = window.setTimeout(() => {
      if (recorderRef.current?.state !== 'inactive') {
        try { recorderRef.current?.stop(); } catch { recorderEndedRef.current = true; }
      }
      recorderEndedRef.current = true;
      speechEndedRef.current = true;
      finalizeRef.current();
    }, 2200);
    finalizeRef.current();
  };

  useEffect(() => () => {
    cancelledRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* Unmount cleanup. */ }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try { recorder.stop(); } catch { /* Unmount cleanup. */ }
    }
    releaseResources();
  }, [releaseResources]);

  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const active = stage === 'recording';
  const dialogOpen = open;
  const handleOpenChange = (next: boolean) => {
    if (!next && (stage === 'recording' || stage === 'requesting' || stage === 'processing')) cancel();
    else setOpen(next);
  };

  return <div className="ai-voice-input" data-testid="component-ai-voice-input">
    <button type="button" className="voice-launch" onClick={() => void start()}
      aria-label={text(lang, 'تسجيل وصف صوتي', 'Record a voice description')} data-testid="button-start-voice">
      <span className="voice-launch-icon"><Mic size={17}/></span>
      <span>{text(lang, 'أضف وصفاً صوتياً', 'Add a voice description')}</span>
    </button>
    {onManualEntry && <button type="button" className="voice-manual-entry" onClick={onManualEntry}>{text(lang, 'اكتب بدلاً من ذلك', 'Type instead')}</button>}
    {showDemo && <div className="voice-demo-option" role="status" data-testid="status-voice-demo">
      <span className="voice-error">{error}</span>
      <p>{text(lang, `مثال جاهز: «${demoTranscript.ar}»`, `Prewritten example: “${demoTranscript.en}”`)}</p>
      <button type="button" className="rw-button rw-button-secondary" onClick={() => {
        onTranscriptRef.current(demoTranscript[lang]);
        setShowDemo(false);
        setError('');
      }} data-testid="button-use-demo-transcript">{text(lang, 'إضافة المثال التجريبي', 'Insert demo sample')}</button>
    </div>}
    {!!error && !showDemo && stage === 'error' && <p className="voice-error" role="alert">{error}</p>}

    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="voice-dialog" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader className="voice-dialog-header">
          <span className="voice-dialog-overline">{text(lang, 'إملاء صوتي', 'VOICE NOTE')}</span>
          <DialogTitle>{text(lang, 'صف المشكلة بصوتك', 'Describe the issue aloud')}</DialogTitle>
          <DialogDescription>{text(lang, 'سيُضاف النص المتاح إلى وصف البلاغ لتراجعه بنفسك.', 'Any available transcript will be added to your report for you to review.')}</DialogDescription>
        </DialogHeader>
        <div className={`voice-dialog-stage ${active ? 'is-live' : ''}`}>
          <div className={`voice-orb ${active ? 'is-live' : ''}`} aria-hidden="true"><Mic2 size={27}/></div>
          <div className="voice-wave-dialog" role="img" aria-label={text(lang, 'موجة مستوى الصوت المباشر', 'Live audio level waveform')}>
            {bars.map((height, index) => <i key={index} style={{ height: `${height}px` }}/>)}
          </div>
          <span className="voice-dialog-timer" role="timer">{formattedTime}</span>
        </div>
        <p className="voice-dialog-message" role={stage === 'error' ? 'alert' : 'status'}>
          {stage === 'requesting' && text(lang, 'بانتظار إذن الميكروفون…', 'Waiting for microphone permission…')}
          {stage === 'recording' && text(lang, 'جارٍ التسجيل — تحدث بوضوح وبالسرعة المناسبة.', 'Recording — speak clearly at a comfortable pace.')}
          {stage === 'processing' && text(lang, 'جاري تحويل الصوت إلى نص...', 'Processing voice into text...')}
          {stage === 'error' && error}
        </p>
        {stage === 'error' && <p className="voice-dialog-example">
          {text(lang, `مثال مكتوب فقط، وليس تفريغاً لتسجيلك: «${demoTranscript.ar}»`, `Prewritten example only, not a transcript of your recording: “${demoTranscript.en}”`)}
        </p>}
        <p className="voice-dialog-disclosure">{text(lang, 'التسجيل لا يُحفظ في تدارك. قد يستخدم المتصفح خدمة التفريغ الصوتي الخاصة به.', 'TADARUK does not save the recording. Your browser may use its own speech service.')}</p>
        <div className="voice-dialog-actions">
          {active ? <button type="button" className="rw-button voice-stop-button" onClick={stop} data-testid="button-stop-voice">
            <Square size={15} fill="currentColor"/>{text(lang, 'إيقاف التسجيل', 'Stop recording')}
          </button> : stage === 'error' ? <>
            <button type="button" className="rw-button rw-button-secondary" onClick={() => void start()} data-testid="button-retry-voice"><RotateCcw size={15}/>{text(lang, 'حاول مرة أخرى', 'Try again')}</button>
            <button type="button" className="rw-button rw-button-quiet" onClick={() => {
              onTranscriptRef.current(demoTranscript[lang]);
              setOpen(false);
              setStage('idle');
              setError('');
              setShowDemo(false);
            }} data-testid="button-use-demo-transcript-from-error">{text(lang, 'إدراج المثال المكتوب', 'Insert prewritten example')}</button>
          </> : null}
          <button type="button" className="rw-button rw-button-quiet" onClick={cancel} data-testid="button-cancel-voice"><X size={15}/>{text(lang, 'إلغاء', 'Cancel')}</button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
