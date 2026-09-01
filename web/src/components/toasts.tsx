import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./ui";

type ToastTone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4_500);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            className="glass-panel flex items-center gap-3 rounded-[var(--radius-md)] p-3 text-sm"
            key={toast.id}
          >
            {toast.tone === "success" && <CheckCircle2 className="size-4 text-emerald-400" />}
            {toast.tone === "error" && <CircleAlert className="size-4 text-red-400" />}
            {toast.tone === "info" && <Info className="size-4 text-orange-400" />}
            <span className="flex-1">{toast.message}</span>
            <Button
              aria-label="Dismiss notification"
              size="icon"
              variant="ghost"
              onClick={() => dismiss(toast.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
