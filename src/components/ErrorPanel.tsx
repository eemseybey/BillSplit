interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="glass-panel rounded-2xl p-3 border border-danger-500/40">
      <p className="text-sm text-danger-300 mb-2">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 rounded-xl bg-danger-500/20 text-danger-200 text-xs font-medium hover:bg-danger-500/30 transition-colors interactive-press"
      >
        Retry
      </button>
    </div>
  );
}
