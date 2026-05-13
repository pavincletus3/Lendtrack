import { create } from 'zustand';

interface SnackbarState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PendingAction {
  /** Run the destructive operation, then clear hidden state. Safe to call multiple times. */
  commit: () => Promise<void>;
  /** Abort the destructive operation and clear hidden state. */
  undo: () => void;
  timer: ReturnType<typeof setTimeout>;
}

interface UiState {
  snackbar: SnackbarState | null;
  hiddenLoanIds: Record<string, true>;
  hiddenPaymentIds: Record<string, true>;
  _pending: PendingAction | null;
  showUndoableAction: (args: {
    message: string;
    actionLabel?: string;
    onCommit: () => void | Promise<void>;
    hideLoanIds?: string[];
    hidePaymentIds?: string[];
    durationMs?: number;
  }) => void;
  showMessage: (message: string) => void;
  dismissSnackbar: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  snackbar: null,
  hiddenLoanIds: {},
  hiddenPaymentIds: {},
  _pending: null,

  showUndoableAction: ({
    message,
    actionLabel = 'Undo',
    onCommit,
    hideLoanIds = [],
    hidePaymentIds = [],
    durationMs = 5000,
  }) => {
    // If a previous undoable action is still pending, commit it immediately (no longer undoable).
    // We do NOT await — the prior's hidden rows stay hidden until its commit resolves.
    const prior = get()._pending;
    if (prior) {
      clearTimeout(prior.timer);
      prior.commit();
    }

    const addedLoans = Object.fromEntries(hideLoanIds.map((id) => [id, true as const]));
    const addedPayments = Object.fromEntries(hidePaymentIds.map((id) => [id, true as const]));

    set((state) => ({
      hiddenLoanIds: { ...state.hiddenLoanIds, ...addedLoans },
      hiddenPaymentIds: { ...state.hiddenPaymentIds, ...addedPayments },
    }));

    let settled = false;

    const cleanup = () => {
      set((state) => {
        const loans = { ...state.hiddenLoanIds };
        const payments = { ...state.hiddenPaymentIds };
        for (const id of hideLoanIds) delete loans[id];
        for (const id of hidePaymentIds) delete payments[id];
        return { hiddenLoanIds: loans, hiddenPaymentIds: payments };
      });
    };

    const clearSelf = () => {
      if (get()._pending === pending) set({ _pending: null });
    };

    const commit = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(pending.timer);
      try {
        await onCommit();
      } catch (e) {
        console.error('Undoable commit failed', e);
      }
      // Keep rows hidden until the destructive op resolved (so the Firestore
      // snapshot has time to drop the row) — only then un-hide and release.
      cleanup();
      clearSelf();
    };

    const undo = () => {
      if (settled) return;
      settled = true;
      clearTimeout(pending.timer);
      cleanup();
      // Snackbar may still be visible (the undo button itself); dismiss it.
      set((state) => ({ snackbar: state.snackbar?.onAction === undoHandler ? null : state.snackbar }));
      clearSelf();
    };

    // Fire commit on timeout, but dismiss the snackbar a tick earlier so the
    // UX feels snappy. The row stays hidden until commit() resolves.
    const timer = setTimeout(() => {
      // Hide the snackbar immediately; keep rows hidden until commit resolves.
      set((state) => ({ snackbar: state.snackbar?.onAction === undoHandler ? null : state.snackbar }));
      commit();
    }, durationMs);

    const undoHandler = undo;
    const pending: PendingAction = { commit, undo, timer };

    set({
      snackbar: { message, actionLabel, onAction: undoHandler },
      _pending: pending,
    });
  },

  showMessage: (message) => {
    set({ snackbar: { message } });
    setTimeout(() => {
      const current = get().snackbar;
      if (current?.message === message && !current.onAction) {
        set({ snackbar: null });
      }
    }, 2500);
  },

  dismissSnackbar: () => {
    const prior = get()._pending;
    if (prior) {
      clearTimeout(prior.timer);
      prior.commit(); // fire-and-forget; rows stay hidden until done
    }
    set({ snackbar: null });
  },
}));
