import { X } from 'lucide-react';

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <button className="error-banner__dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
