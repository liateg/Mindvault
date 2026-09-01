import { FolderKanban, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog } from "../components/dialog";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  RoleBadge,
  StatePanel,
  Textarea,
} from "../components/ui";
import { useToast } from "../components/toasts";
import { errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { useCreateProject, useProjects } from "../lib/resources";

export function ProjectsPage() {
  const projects = useProjects();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createProject.mutateAsync({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      notify("Project created", "success");
      setOpen(false);
      setTitle("");
      setDescription("");
      navigate(`/app/projects/${created.id}`);
    } catch (error) {
      notify(errorMessage(error, "Unable to create project"), "error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Choose a workspace or create a new project."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />
      {projects.isPending ? (
        <StatePanel loading title="Loading projects" />
      ) : projects.isError ? (
        <StatePanel
          title="Unable to load projects"
          description={errorMessage(projects.error, "Please try again.")}
        />
      ) : projects.data.length === 0 ? (
        <StatePanel
          title="No projects yet"
          description="Create a project to start capturing decisions with your team."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Create project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <Link key={project.id} to={`/app/projects/${project.id}`}>
              <Card className="h-full p-5 transition hover:border-[var(--color-line-strong)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-orange-950/60 text-orange-300">
                    <FolderKanban className="size-4" />
                  </span>
                  <RoleBadge role={project.role} />
                </div>
                <h2 className="text-lg font-semibold">{project.title}</h2>
                <p className="mt-2 line-clamp-3 min-h-16 text-sm leading-6 text-muted">
                  {project.description || "No description yet."}
                </p>
                <p className="mt-4 text-xs text-subtle">Updated {formatDate(project.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        title="Create project"
        description="Projects hold decisions, members, and assistant context."
        onClose={() => setOpen(false)}
      >
        <form className="space-y-4" onSubmit={onCreate}>
          <Field label="Title">
            <Input
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </Field>
          <Field label="Description">
            <Textarea
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createProject.isPending} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
