import { useState, useRef, useCallback, useEffect } from "react";

const INACTIVITY_TIMEOUT = 8000; // 8 seconds
const ANKY_THRESHOLD = 480; // 8 minutes in seconds

interface SessionStats {
  wordCount: number;
  wpm: number;
  duration: number;
  backspaceCount: number;
  enterCount: number;
  arrowCount: number;
}

interface UseWritingSessionReturn {
  content: string;
  isWriting: boolean;
  stats: SessionStats;
  timeRemaining: number;
  isComplete: boolean;
  isDanger: boolean;
  isAnkyMode: boolean;
  startSession: () => void;
  endSession: () => void;
  handleInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  reset: () => void;
}

export function useWritingSession(): UseWritingSessionReturn {
  const [content, setContent] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    wordCount: 0,
    wpm: 0,
    duration: 0,
    backspaceCount: 0,
    enterCount: 0,
    arrowCount: 0,
  });
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT / 1000);

  const sessionStartTime = useRef<number | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSessionEnd = useRef<(() => void) | null>(null);

  const isComplete = stats.duration >= ANKY_THRESHOLD;
  const isDanger = timeRemaining < 2;
  const isAnkyMode = stats.duration >= ANKY_THRESHOLD;

  const clearTimers = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    setTimeRemaining(INACTIVITY_TIMEOUT / 1000);

    inactivityTimer.current = setTimeout(() => {
      // Session ended due to inactivity
      if (onSessionEnd.current) {
        onSessionEnd.current();
      }
    }, INACTIVITY_TIMEOUT);
  }, []);

  const calculateStats = useCallback(
    (text: string, startTime: number) => {
      const words = text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);
      const wordCount = words.length;
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const minutes = duration / 60;
      const wpm = minutes > 0 ? Math.round(wordCount / minutes) : 0;

      setStats((prev) => ({
        ...prev,
        wordCount,
        wpm,
        duration,
      }));
    },
    []
  );

  const startSession = useCallback(() => {
    setIsWriting(true);
    sessionStartTime.current = Date.now();
    setStats({
      wordCount: 0,
      wpm: 0,
      duration: 0,
      backspaceCount: 0,
      enterCount: 0,
      arrowCount: 0,
    });

    resetInactivityTimer();

    // Start duration counter
    durationInterval.current = setInterval(() => {
      if (sessionStartTime.current) {
        calculateStats(content, sessionStartTime.current);

        // Update time remaining
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 0.1);
          return Math.round(newTime * 10) / 10;
        });
      }
    }, 100);
  }, [content, calculateStats, resetInactivityTimer]);

  const endSession = useCallback(() => {
    clearTimers();
    setIsWriting(false);
  }, [clearTimers]);

  // Store the end session callback
  useEffect(() => {
    onSessionEnd.current = endSession;
  }, [endSession]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);

      if (isWriting && sessionStartTime.current) {
        calculateStats(newContent, sessionStartTime.current);
        resetInactivityTimer();
      }
    },
    [isWriting, calculateStats, resetInactivityTimer]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Start session on first keystroke
      if (!isWriting && !e.ctrlKey && !e.metaKey) {
        startSession();
      }

      // Block certain key combinations
      if (e.ctrlKey || e.metaKey) {
        const blockedKeys = ["a", "x", "c", "v", "z", "y"];
        if (blockedKeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
          return;
        }
      }

      // Track special keys
      if (e.key === "Backspace") {
        setStats((prev) => ({
          ...prev,
          backspaceCount: prev.backspaceCount + 1,
        }));
      } else if (e.key === "Enter") {
        e.preventDefault(); // No newlines
        setStats((prev) => ({
          ...prev,
          enterCount: prev.enterCount + 1,
        }));
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        setStats((prev) => ({
          ...prev,
          arrowCount: prev.arrowCount + 1,
        }));
      }

      // Reset inactivity on any key
      if (isWriting) {
        resetInactivityTimer();
      }
    },
    [isWriting, startSession, resetInactivityTimer]
  );

  const reset = useCallback(() => {
    clearTimers();
    setContent("");
    setIsWriting(false);
    setStats({
      wordCount: 0,
      wpm: 0,
      duration: 0,
      backspaceCount: 0,
      enterCount: 0,
      arrowCount: 0,
    });
    setTimeRemaining(INACTIVITY_TIMEOUT / 1000);
    sessionStartTime.current = null;
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    content,
    isWriting,
    stats,
    timeRemaining,
    isComplete,
    isDanger,
    isAnkyMode,
    startSession,
    endSession,
    handleInput,
    handleKeyDown,
    reset,
  };
}
