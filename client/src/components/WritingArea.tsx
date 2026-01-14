import { useRef, useEffect } from "react";

interface WritingAreaProps {
  content: string;
  isWriting: boolean;
  stats: {
    wordCount: number;
    wpm: number;
    duration: number;
    backspaceCount: number;
    enterCount: number;
    arrowCount: number;
  };
  timeRemaining: number;
  isDanger: boolean;
  isAnkyMode: boolean;
  onInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function WritingArea({
  content,
  isWriting,
  stats,
  timeRemaining,
  isDanger,
  isAnkyMode,
  onInput,
  onKeyDown,
}: WritingAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Keep cursor at end
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [content]);

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Hero - shown when not writing */}
      {!isWriting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="text-4xl md:text-6xl font-bold text-fg/90 tracking-tight">
            YOUR MIND IS LOUD
          </h1>
          <p className="mt-4 text-lg text-muted">
            let it speak (for 8 minutes, without thinking)
          </p>
        </div>
      )}

      {/* Timer bar */}
      {isWriting && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50">
          <div
            className={`h-full transition-all duration-100 ${
              isDanger ? "bg-danger timer-danger" : "bg-primary"
            }`}
            style={{ width: `${(timeRemaining / 8) * 100}%` }}
          />
        </div>
      )}

      {/* Stats bar */}
      {isWriting && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary/10 border-t border-primary/20 px-4 py-3 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="text-fg">
                <span className="text-muted">words</span> {stats.wordCount}
              </span>
              <span className="text-fg">
                <span className="text-muted">wpm</span> {stats.wpm}
              </span>
              <span className={isAnkyMode ? "text-primary font-medium" : "text-fg"}>
                <span className="text-muted">time</span>{" "}
                {formatDuration(stats.duration)}
              </span>
              {isAnkyMode && (
                <span className="text-primary animate-pulse">becoming anky</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-muted">
              <span className="text-danger">{stats.backspaceCount}</span>
              <span className="text-purple">{stats.enterCount}</span>
              <span className="text-gold">{stats.arrowCount}</span>
              <span
                className={`text-xs ${isDanger ? "text-danger" : "text-muted"}`}
              >
                {timeRemaining.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Writing area */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onPaste={(e) => e.preventDefault()}
        placeholder="start typing..."
        className={`
          flex-1 w-full max-w-4xl mx-auto p-8 pt-20
          bg-transparent text-fg text-lg leading-relaxed
          resize-none outline-none placeholder:text-muted/50
          ${isWriting ? "pb-24" : ""}
        `}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
