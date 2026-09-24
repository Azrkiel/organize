"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Pause, Play, Square } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createLecture, finishRecording, saveLiveTranscript } from "@/app/(app)/actions/lectures";
import { ackRecordingPolicy } from "@/app/(app)/actions/lectures";
import {
  getSpeechRecognitionCtor,
  persistStorage,
  pickAudioMimeType,
  requestWakeLock,
  type SpeechRecognitionLike,
} from "@/lib/client/lecture-recording-support";
import { getInProgressRecordings, saveChunk, saveRecordingMeta, type RecordingMeta } from "@/lib/client/lecture-audio-db";
import { generateLectureTitle } from "@/lib/lecture-title";
import { formatClock } from "@/lib/focus-timer";
import type { Course } from "@/lib/types";

const SEGMENT_MS = 10 * 60 * 1000; // Whisper decodes each segment on its own — see PLAN.md Phase 9 task 2.
const CHUNK_TIMESLICE_MS = 10_000; // MediaRecorder flushes to IndexedDB this often.
const LIVE_SAVE_INTERVAL_MS = 30_000;
const TICK_MS = 500;

type RecState = "idle" | "recording" | "paused" | "finished";

export function RecordView({ courses, initialPolicyAcked }: { courses: Course[]; initialPolicyAcked: boolean }) {
  const router = useRouter();

  const [policyAcked, setPolicyAcked] = useState(initialPolicyAcked);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(courses[0]?.id ?? null);
  const [title, setTitle] = useState(() => generateLectureTitle(courses[0]?.name, new Date()));
  const [state, setState] = useState<RecState>("idle");
  const [, forceTick] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedLecture, setSavedLecture] = useState<{ id: string; title: string; courseId: string | null } | null>(null);
  const [resumable, setResumable] = useState<RecordingMeta[]>([]);

  const courseItems = useMemo(
    () => ({ __none__: "No course", ...Object.fromEntries(courses.map((c) => [c.id, c.name])) }),
    [courses]
  );
  const titleTouchedRef = useRef(false);

  // Mutable recording internals — kept in refs so updating them never triggers a re-render;
  // `forceTick` below is the one thing driving the visible clock, same pattern as the focus timer.
  const lectureIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentIndexRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const rotatingRef = useRef(false);
  const segmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTextRef = useRef(""); // mirrors interimText state for synchronous reads (see stopLiveTranscript)
  const startedAtRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const liveSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");

  useEffect(() => {
    getInProgressRecordings()
      .then(setResumable)
      .catch(() => {});
  }, []);

  // Ticks the visible clock; the actual elapsed time is always re-derived from startedAt/paused
  // bookkeeping (computeElapsedMs), never a counted-up local variable — the same reasoning as the
  // focus timer's countdown: a background tab throttles setInterval, but not Date.now().
  useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const id = setInterval(() => forceTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [state]);

  function computeElapsedMs(): number {
    const startedAt = startedAtRef.current;
    if (startedAt === null) return 0;
    const end = pausedAtRef.current ?? Date.now();
    return Math.max(0, end - startedAt - pausedAccumMsRef.current);
  }

  function beginSegment(lectureId: string) {
    const stream = streamRef.current;
    if (!stream) return;
    chunkIndexRef.current = 0;
    const options = mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : undefined;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      recorder = new MediaRecorder(stream); // an unsupported mimeType option — fall back to the browser's default
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        const idx = chunkIndexRef.current++;
        saveChunk(lectureId, segmentIndexRef.current, idx, e.data).catch((err) => console.error("Failed to save audio chunk", err));
      }
    };
    recorder.onstop = () => {
      if (rotatingRef.current) {
        rotatingRef.current = false;
        segmentIndexRef.current += 1;
        beginSegment(lectureId);
      }
    };
    recorder.start(CHUNK_TIMESLICE_MS);
    recorderRef.current = recorder;
    if (segmentTimeoutRef.current) clearTimeout(segmentTimeoutRef.current);
    segmentTimeoutRef.current = setTimeout(() => {
      rotatingRef.current = true;
      recorderRef.current?.stop();
    }, SEGMENT_MS);
  }

  function startLiveTranscript() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);
    shouldListenRef.current = true;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + text.trim();
          setLiveText(finalTranscriptRef.current);
        } else {
          interim += text;
        }
      }
      interimTextRef.current = interim;
      setInterimText(interim);
    };
    recognition.onerror = (event) => {
      const err = (event as Event & { error?: string }).error;
      if (err && err !== "no-speech" && err !== "aborted") console.error("Speech recognition error", err);
    };
    recognition.onend = () => {
      // The browser stops recognition after a pause in speech — restart it while we're still
      // meant to be listening (PLAN.md Phase 9 task 3).
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          // Already running, or the tab lost focus — the next onend will try again.
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}

    if (!liveSaveIntervalRef.current) {
      liveSaveIntervalRef.current = setInterval(() => {
        const id = lectureIdRef.current;
        if (id) saveLiveTranscript({ id, transcriptLive: finalTranscriptRef.current }).catch(() => {});
      }, LIVE_SAVE_INTERVAL_MS);
    }
  }

  /** Stops the recognizer and waits for it to actually finish, instead of just firing `.stop()`
   * and moving on. Calling `.stop()` makes the browser finalize whatever it was still holding as
   * interim, but that arrives as an async `onresult` + `onend` some time later — reading
   * `finalTranscriptRef` immediately after `.stop()` (the previous version of this function) races
   * that and typically catches only whatever had already finalized on its own, which for a short
   * recording can be almost nothing. This also folds in anything still-interim as a last resort,
   * in case a browser's `onend` fires without ever finalizing the tail. */
  function stopLiveTranscript(): Promise<void> {
    shouldListenRef.current = false;
    if (liveSaveIntervalRef.current) {
      clearInterval(liveSaveIntervalRef.current);
      liveSaveIntervalRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        const leftover = interimTextRef.current.trim();
        if (leftover && !finalTranscriptRef.current.endsWith(leftover)) {
          finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + leftover;
          setLiveText(finalTranscriptRef.current);
        }
        interimTextRef.current = "";
        setInterimText("");
        resolve();
      }
      recognition.onend = finish;
      try {
        recognition.stop();
      } catch {
        finish();
      }
      setTimeout(finish, 1200); // safety net if `onend` never fires
    });
  }

  async function handleStart() {
    setError(null);
    if (!policyAcked) {
      setShowPolicyDialog(true);
      return;
    }
    await beginNewRecording();
  }

  async function acknowledgePolicy() {
    setShowPolicyDialog(false);
    setPolicyAcked(true);
    ackRecordingPolicy().catch(() => {});
    await beginNewRecording();
  }

  async function beginNewRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Couldn't access the microphone. Check your browser's permission for this site.");
      return;
    }

    const result = await createLecture({ courseId, title: title.trim() || generateLectureTitle(null, new Date()) });
    if (result.error || !result.id) {
      setError(result.error ?? "Could not start the lecture.");
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    lectureIdRef.current = result.id;
    mimeTypeRef.current = pickAudioMimeType();
    segmentIndexRef.current = 0;
    startedAtRef.current = Date.now();
    pausedAccumMsRef.current = 0;
    pausedAtRef.current = null;
    finalTranscriptRef.current = "";
    setLiveText("");
    setInterimText("");
    setResumable([]);

    await saveRecordingMeta({
      lectureId: result.id,
      courseId,
      title,
      mimeType: mimeTypeRef.current,
      segmentIndex: 0,
      startedAt: startedAtRef.current,
      recording: true,
    });

    beginSegment(result.id);
    startLiveTranscript();
    requestWakeLock().then((lock) => (wakeLockRef.current = lock));
    persistStorage();

    setState("recording");
  }

  function handlePause() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.pause();
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
    stopLiveTranscript();
    pausedAtRef.current = Date.now();
    setState("paused");
  }

  function handleResume() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "paused") recorder.resume();
    // Restarts the segment's rotation window from full length rather than the exact remainder —
    // segments may end up a little short of 10 minutes across a pause, which only makes Whisper's
    // per-segment memory footprint smaller, never a problem.
    if (segmentTimeoutRef.current === null && recorderRef.current) {
      segmentTimeoutRef.current = setTimeout(() => {
        rotatingRef.current = true;
        recorderRef.current?.stop();
      }, SEGMENT_MS);
    }
    pausedAccumMsRef.current += Date.now() - (pausedAtRef.current ?? Date.now());
    pausedAtRef.current = null;
    startLiveTranscript();
    setState("recording");
  }

  async function handleStop() {
    const lectureId = lectureIdRef.current;
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
    rotatingRef.current = false; // don't let a queued onstop open a new segment after we've stopped
    await stopLiveTranscript(); // waits for the recognizer to actually finalize before we save (see its own comment)

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;

    const durationSeconds = Math.round(computeElapsedMs() / 1000);
    const finishedCourseId = courseId;
    const finishedTitle = title;

    if (lectureId) {
      await saveLiveTranscript({ id: lectureId, transcriptLive: finalTranscriptRef.current });
      await finishRecording({ id: lectureId, durationSeconds });
      await saveRecordingMeta({
        lectureId,
        courseId: finishedCourseId,
        title: finishedTitle,
        mimeType: mimeTypeRef.current,
        segmentIndex: segmentIndexRef.current,
        startedAt: startedAtRef.current ?? Date.now(),
        recording: false,
      });
    }

    setSavedLecture(lectureId ? { id: lectureId, title: finishedTitle, courseId: finishedCourseId } : null);
    setState("finished");
    router.refresh();
  }

  async function handleContinueResumable(meta: RecordingMeta) {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Couldn't access the microphone to continue the recording.");
      return;
    }
    setResumable((prev) => prev.filter((r) => r.lectureId !== meta.lectureId));
    streamRef.current = stream;
    lectureIdRef.current = meta.lectureId;
    setCourseId(meta.courseId);
    setTitle(meta.title);
    mimeTypeRef.current = meta.mimeType;
    segmentIndexRef.current = meta.segmentIndex + 1; // the prior segment may already be flushed; start clean
    startedAtRef.current = meta.startedAt;
    pausedAccumMsRef.current = 0; // the reload gap itself just counts as elapsed time — an underestimate, not an overestimate
    pausedAtRef.current = null;
    finalTranscriptRef.current = "";

    await saveRecordingMeta({ ...meta, segmentIndex: segmentIndexRef.current, recording: true });
    beginSegment(meta.lectureId);
    startLiveTranscript();
    requestWakeLock().then((lock) => (wakeLockRef.current = lock));
    persistStorage();
    setState("recording");
  }

  async function handleFinalizeResumable(meta: RecordingMeta) {
    const seconds = Math.max(0, Math.round((Date.now() - meta.startedAt) / 1000));
    await finishRecording({ id: meta.lectureId, durationSeconds: seconds });
    await saveRecordingMeta({ ...meta, recording: false });
    setResumable((prev) => prev.filter((r) => r.lectureId !== meta.lectureId));
    router.refresh();
  }

  function handleTitleChange(value: string) {
    titleTouchedRef.current = true;
    setTitle(value);
  }

  function handleCourseChange(value: string | null) {
    const next = value === "__none__" || value === null ? null : value;
    setCourseId(next);
    if (!titleTouchedRef.current) {
      const course = courses.find((c) => c.id === next);
      setTitle(generateLectureTitle(course?.name, new Date()));
    }
  }

  const elapsedSeconds = Math.round(computeElapsedMs() / 1000);
  const idle = state === "idle";
  const recording = state === "recording";
  const paused = state === "paused";
  const finished = state === "finished";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {resumable.length > 0 && idle && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Unfinished recording found</p>
          {resumable.map((meta) => (
            <div key={meta.lectureId} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                &ldquo;{meta.title}&rdquo; — started {new Date(meta.startedAt).toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleContinueResumable(meta)}>
                  Continue recording
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleFinalizeResumable(meta)}>
                  Stop and keep audio
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {finished ? (
        <div className="space-y-3 rounded-lg border p-4 text-center">
          <p className="font-medium">Recording saved</p>
          <p className="text-sm text-muted-foreground">
            &ldquo;{savedLecture?.title}&rdquo; — {formatClock(elapsedSeconds)}
          </p>
          <div className="flex justify-center gap-2">
            {savedLecture?.courseId && (
              <a href={`/courses/${savedLecture.courseId}`} className={buttonVariants({ variant: "outline" })}>
                View lecture
              </a>
            )}
            <Button onClick={() => setState("idle")}>Record another</Button>
          </div>
        </div>
      ) : (
        <>
          {idle && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Course</Label>
                <Select items={courseItems} value={courseId ?? "__none__"} onValueChange={handleCourseChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No course</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lecture-title">Title</Label>
                <Input id="lecture-title" value={title} onChange={(e) => handleTitleChange(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-2 text-center">
            {!idle && (
              <p className="text-sm font-medium text-muted-foreground">
                {recording ? "Recording" : "Paused"}
                {title ? ` · ${title}` : ""}
              </p>
            )}
            <p className="font-mono text-6xl font-semibold tabular-nums tracking-tight">{formatClock(elapsedSeconds)}</p>
          </div>

          <div className="flex justify-center gap-2">
            {idle && (
              <Button size="lg" onClick={handleStart}>
                <Mic className="size-4" /> Start
              </Button>
            )}
            {recording && (
              <Button size="lg" variant="outline" onClick={handlePause}>
                <Pause className="size-4" /> Pause
              </Button>
            )}
            {paused && (
              <Button size="lg" onClick={handleResume}>
                <Play className="size-4" /> Resume
              </Button>
            )}
            {(recording || paused) && (
              <Button size="lg" variant="destructive" onClick={handleStop}>
                <Square className="size-4" /> Stop
              </Button>
            )}
          </div>

          {!idle && (
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Live transcript</p>
              {speechSupported ? (
                <p className="max-h-48 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
                  {liveText}
                  <span className="text-muted-foreground">{liveText && interimText ? " " : ""}{interimText}</span>
                  {!liveText && !interimText && <span className="text-muted-foreground">Listening…</span>}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Live transcription isn&apos;t supported in this browser. The accurate transcript will still work after class.
                </p>
              )}
            </div>
          )}

          {idle && (
            <p className="text-center text-xs text-muted-foreground">
              Recording works best on a laptop — some phones stop recording when the screen locks.
              {speechSupported ? " Chrome's live transcript is processed on Google's servers." : ""}
            </p>
          )}
        </>
      )}

      <AlertDialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Before you record</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re responsible for following your school&apos;s and your professor&apos;s recording policies. Some
              courses require permission before recording lectures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={acknowledgePolicy}>I understand, start recording</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
