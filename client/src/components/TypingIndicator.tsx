interface TypingIndicatorProps {
  text?: string;
}

export default function TypingIndicator({
  text = "Anky is typing...",
}: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary rounded-full typing-dot" />
        <span className="w-2 h-2 bg-primary rounded-full typing-dot" />
        <span className="w-2 h-2 bg-primary rounded-full typing-dot" />
      </div>
      <span className="text-sm text-muted">{text}</span>
    </div>
  );
}
