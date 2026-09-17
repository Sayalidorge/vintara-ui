import React, { useCallback, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

// Promise-based wrapper around <ConfirmDialog />, so call sites can replace
// `if (!window.confirm("...")) return;` with `if (!(await confirm("..."))) return;`
// almost verbatim - window.confirm() is synchronous and blocks until the
// user answers; a React modal can't block like that, so this resolves a
// Promise from the dialog's onConfirm/onCancel instead. The enclosing
// function just needs to be async, which every caller already was (they all
// follow with a fetch call).
export const useConfirm = () => {
  const [dialogState, setDialogState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogState(typeof options === "string" ? { message: options } : options);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setDialogState(null);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setDialogState(null);
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialogElement = dialogState ? (
    <ConfirmDialog
      isOpen
      title={dialogState.title}
      message={dialogState.message}
      confirmLabel={dialogState.confirmLabel}
      cancelLabel={dialogState.cancelLabel}
      danger={dialogState.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmDialogElement };
};

export default useConfirm;
