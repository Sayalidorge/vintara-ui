import React, { useCallback, useRef, useState } from "react";
import "./Toast.css";

// Local-state hook, no React Context - matches this codebase's convention of
// per-page state rather than app-wide providers. A page that wants toasts
// calls useToast() and renders <ToastContainer /> once, anywhere in its tree.
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "success", durationMs = 3500) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (durationMs > 0) {
      setTimeout(() => dismissToast(id), durationMs);
    }
    return id;
  }, [dismissToast]);

  return { toasts, showToast, dismissToast };
};

const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-message">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => onDismiss(t.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
