import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  DecisionBadge,
  PageHeader,
  RoleBadge,
  StatePanel,
} from "../components/ui";
import { errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { useDecisions, useMembers, useProject } from "../lib/resources";

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const project = useProject(projectId);
  const decisions = useDecisions(projectId);
  const members = useMembers(projectId);
  const approved = decisions.data?.filter((decision) => decision.status === "approved") ?? [];

  if (project.isPending) {
    return <StatePanel loading title="Loading project" />;
  }
  if (project.isError || !project.data) {
    return (
      <StatePanel
        title="Unable to load project"
        description={errorMessage(project.error, "This project may not exist or you may not have access.")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Overview"
        title={project.data.title}
        description={project.data.description || "No description yet."}
        actions={
          <>
            <RoleBadge role={project.data.role} />
            <Link to={`/app/projects/${project.data.id}/decisions`}>
              <Button variant="secondary">Open decisions</Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Members</p>
          <p className="mt-2 text-3xl font-semibold">{members.data?.length ?? "—"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Approved decisions</p>
          <p className="mt-2 text-3xl font-semibold">{approved.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Updated</p>
          <p className="mt-2 text-3xl font-semibold">{formatDate(project.data.updatedAt)}</p>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Approved decisions</h2>
          <Link className="text-sm text-orange-300" to={`/app/projects/${project.data.id}/decisions`}>
            View workspace
          </Link>
        </div>
        {decisions.isPending ? (
          <StatePanel loading title="Loading decisions" />
        ) : approved.length === 0 ? (
          <StatePanel
            title="No approved decisions yet"
            description="Approved choices become the shared memory your team and assistant follow."
          />
        ) : (
          <div className="space-y-3">
            {approved.slice(0, 6).map((decision) => (
              <Link
                className="block rounded-xl border border-line bg-black/20 p-4"
                key={decision.id}
                to={`/app/projects/${project.data.id}/decisions?decision=${decision.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{decision.title}</p>
                  <DecisionBadge status={decision.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{decision.proposalContent}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
