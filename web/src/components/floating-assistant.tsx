import { Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AssistantPanel } from "./assistant-panel";

export function FloatingAssistant() {
  const { projectId } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const onAssistantRoute = location.pathname.endsWith("/assistant");

  useEffect(() => {
    setOpen(false);
  }, [projectId, location.pathname]);

  if (!projectId || onAssistantRoute) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="pointer-events-auto h-[min(34rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2.5rem))]">
          <AssistantPanel compact projectId={projectId} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <button
          aria-label="Open project assistant"
          className="assistant-fab pointer-events-auto"
          type="button"
          onClick={() => setOpen(true)}
        >
          <Brain className="size-6" strokeWidth={2.1} />
        </button>
      )}
    </div>
  );
}
