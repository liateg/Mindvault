import { useParams } from "react-router-dom";
import { AssistantPanel } from "../components/assistant-panel";
import { StatePanel } from "../components/ui";
import { useProject } from "../lib/resources";
import { errorMessage } from "../lib/api";

export function AssistantPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);

  if (project.isPending) return <StatePanel loading title="Loading assistant" />;
  if (project.isError || !project.data) {
    return (
      <StatePanel
        title="Unable to open assistant"
        description={errorMessage(project.error, "Project access is required.")}
      />
    );
  }

  return (
    <div className="assistant-page">
      <p className="assistant-page-kicker">{project.data.title}</p>
      <AssistantPanel projectId={projectId} />
    </div>
  );
}
