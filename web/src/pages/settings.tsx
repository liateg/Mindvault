import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmationDialog } from "../components/dialog";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  StatePanel,
  Textarea,
} from "../components/ui";
import { useToast } from "../components/toasts";
import { errorMessage } from "../lib/api";
import { can } from "../lib/permissions";
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from "../lib/resources";

export function SettingsPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canMaintain = can(project.data?.role, "maintain");
  const canAdmin = can(project.data?.role, "admin");

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project.data) return;
    try {
      await updateProject.mutateAsync({
        title: (title ?? project.data.title).trim(),
        description: (description ?? project.data.description ?? "").trim() || null,
      });
      notify("Project updated", "success");
    } catch (error) {
      notify(errorMessage(error, "Unable to update project"), "error");
    }
  }

  if (project.isPending) return <StatePanel loading title="Loading settings" />;
  if (project.isError || !project.data) {
    return (
      <StatePanel
        title="Unable to load settings"
        description={errorMessage(project.error, "You may not have access to this project.")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title={project.data.title}
        description="Update project details or remove the workspace."
      />
      <Card className="p-5">
        <form className="space-y-4" onSubmit={onSave}>
          <Field label="Title">
            <Input
              disabled={!canMaintain}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title ?? project.data.title}
            />
          </Field>
          <Field label="Description">
            <Textarea
              disabled={!canMaintain}
              onChange={(event) => setDescription(event.target.value)}
              value={description ?? project.data.description ?? ""}
            />
          </Field>
          {canMaintain ? (
            <Button disabled={updateProject.isPending} type="submit">
              Save changes
            </Button>
          ) : (
            <p className="text-sm text-muted">Maintain permission is required to edit this project.</p>
          )}
        </form>
      </Card>
      {canAdmin ? (
        <Card className="mt-5 border-[var(--color-danger)]/30 p-5">
          <h2 className="font-semibold">Delete project</h2>
          <p className="mt-2 text-sm text-muted">
            This permanently removes the project, members, invitations, and decisions.
          </p>
          <Button className="mt-4" variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete project
          </Button>
        </Card>
      ) : null}
      <ConfirmationDialog
        confirmLabel="Delete project"
        description="This cannot be undone."
        open={deleteOpen}
        title="Delete this project?"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          void deleteProject
            .mutateAsync(projectId)
            .then(() => {
              notify("Project deleted", "success");
              navigate("/app");
            })
            .catch((error) => {
              notify(errorMessage(error, "Unable to delete project"), "error");
            });
        }}
      />
    </div>
  );
}
