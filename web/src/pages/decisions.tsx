import { FormEvent, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ConfirmationDialog, Dialog } from "../components/dialog";
import {
  Button,
  Card,
  DecisionBadge,
  Field,
  Input,
  PageHeader,
  StatePanel,
  Textarea,
} from "../components/ui";
import { useToast } from "../components/toasts";
import { errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { can } from "../lib/permissions";
import {
  useCreateDecision,
  useDecisions,
  useDeleteDecision,
  useProject,
  useReviewDecision,
  useUpdateDecision,
} from "../lib/resources";
import type { Decision, DecisionStatus } from "../lib/types";

const tabs: Array<{ id: "all" | DecisionStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "proposed", label: "Review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "superseded", label: "Superseded" },
];

export function DecisionsPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const decisions = useDecisions(projectId);
  const createDecision = useCreateDecision(projectId);
  const updateDecision = useUpdateDecision(projectId);
  const reviewDecision = useReviewDecision(projectId);
  const deleteDecision = useDeleteDecision(projectId);
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("decision");
  const statusFilter = (params.get("status") as DecisionStatus | "all" | null) ?? "all";
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [proposalContent, setProposalContent] = useState("");
  const [llmReasoningSummary, setLlmReasoningSummary] = useState("");

  const role = project.data?.role;
  const canWrite = can(role, "write");
  const canReview = can(role, "review");
  const filtered = useMemo(() => {
    const items = decisions.data ?? [];
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [decisions.data, statusFilter]);
  const selected =
    filtered.find((item) => item.id === selectedId) ??
    (decisions.data ?? []).find((item) => item.id === selectedId) ??
    filtered[0];

  function setSelected(decision: Decision | undefined) {
    const next = new URLSearchParams(params);
    if (decision) next.set("decision", decision.id);
    else next.delete("decision");
    setParams(next, { replace: true });
  }

  function setStatus(status: "all" | DecisionStatus) {
    const next = new URLSearchParams(params);
    if (status === "all") next.delete("status");
    else next.set("status", status);
    setParams(next, { replace: true });
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createDecision.mutateAsync({
        title: title.trim(),
        proposalContent: proposalContent.trim(),
        ...(llmReasoningSummary.trim()
          ? { llmReasoningSummary: llmReasoningSummary.trim() }
          : {}),
      });
      notify("Proposal created", "success");
      setCreateOpen(false);
      setTitle("");
      setProposalContent("");
      setLlmReasoningSummary("");
      setSelected(created);
    } catch (error) {
      notify(errorMessage(error, "Unable to create proposal"), "error");
    }
  }

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      await updateDecision.mutateAsync({
        decisionId: selected.id,
        body: {
          title: title.trim(),
          proposalContent: proposalContent.trim(),
          llmReasoningSummary: llmReasoningSummary.trim() || null,
        },
      });
      notify("Decision updated", "success");
      setEditOpen(false);
    } catch (error) {
      notify(errorMessage(error, "Unable to update decision"), "error");
    }
  }

  async function onReview(status: Exclude<DecisionStatus, "proposed">) {
    if (!selected) return;
    try {
      await reviewDecision.mutateAsync({ decisionId: selected.id, status });
      notify(`Marked ${status}`, "success");
    } catch (error) {
      notify(errorMessage(error, "Unable to review decision"), "error");
    }
  }

  function openEdit(decision: Decision) {
    setTitle(decision.title);
    setProposalContent(decision.proposalContent);
    setLlmReasoningSummary(decision.llmReasoningSummary ?? "");
    setEditOpen(true);
  }

  if (project.isPending || decisions.isPending) {
    return <StatePanel loading title="Loading decision workspace" />;
  }
  if (project.isError || decisions.isError || !project.data) {
    return (
      <StatePanel
        title="Unable to load decisions"
        description={errorMessage(
          project.error ?? decisions.error,
          "Check your access and try again.",
        )}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Decision workspace"
        title="What the team decided"
        description="Review proposals, preserve approved choices, and keep rejected or superseded work visible."
        actions={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>New proposal</Button>
          ) : null
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={statusFilter === tab.id ? "primary" : "secondary"}
            onClick={() => setStatus(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <Card className="p-3">
          {filtered.length === 0 ? (
            <StatePanel
              title={statusFilter === "proposed" ? "Review queue is empty" : "No decisions yet"}
              description={
                canWrite
                  ? "Create a proposal to start the review workflow."
                  : "Decisions will appear here when the team adds them."
              }
            />
          ) : (
            <div className="space-y-1">
              {filtered.map((decision) => (
                <button
                  className={`w-full rounded-lg px-3 py-3 text-left ${
                    selected?.id === decision.id
                      ? "ember-edge bg-orange-950/25"
                      : "hover:bg-white/[0.04]"
                  }`}
                  key={decision.id}
                  type="button"
                  onClick={() => setSelected(decision)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{decision.title}</p>
                    <DecisionBadge status={decision.status} />
                  </div>
                  <p className="mt-1 text-xs text-subtle">{formatDate(decision.updatedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5 sm:p-6">
          {!selected ? (
            <StatePanel
              title="Select a decision"
              description="Choose an item from the list to inspect reasoning and review actions."
            />
          ) : (
            <DecisionDetail
              decision={selected}
              canWrite={canWrite}
              canReview={canReview}
              onEdit={() => openEdit(selected)}
              onDelete={() => setDeleteOpen(true)}
              onReview={onReview}
              reviewing={reviewDecision.isPending}
            />
          )}
        </Card>
      </div>
      <Dialog
        open={createOpen}
        title="Propose a decision"
        description="Write the choice and the reasoning your team should review."
        onClose={() => setCreateOpen(false)}
      >
        <form className="space-y-4" onSubmit={onCreate}>
          <Field label="Title">
            <Input onChange={(event) => setTitle(event.target.value)} required value={title} />
          </Field>
          <Field label="Proposal">
            <Textarea
              onChange={(event) => setProposalContent(event.target.value)}
              required
              value={proposalContent}
            />
          </Field>
          <Field label="Reasoning summary">
            <Textarea
              onChange={(event) => setLlmReasoningSummary(event.target.value)}
              value={llmReasoningSummary}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createDecision.isPending} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={editOpen} title="Edit decision" onClose={() => setEditOpen(false)}>
        <form className="space-y-4" onSubmit={onEdit}>
          <Field label="Title">
            <Input onChange={(event) => setTitle(event.target.value)} required value={title} />
          </Field>
          <Field label="Proposal">
            <Textarea
              onChange={(event) => setProposalContent(event.target.value)}
              required
              value={proposalContent}
            />
          </Field>
          <Field label="Reasoning summary">
            <Textarea
              onChange={(event) => setLlmReasoningSummary(event.target.value)}
              value={llmReasoningSummary}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={updateDecision.isPending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmationDialog
        confirmLabel="Delete"
        description="This removes the decision from the project workspace."
        open={deleteOpen}
        title="Delete this decision?"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selected) return;
          void deleteDecision
            .mutateAsync(selected.id)
            .then(() => {
              notify("Decision deleted", "success");
              setDeleteOpen(false);
              setSelected(undefined);
            })
            .catch((error) => {
              notify(errorMessage(error, "Unable to delete decision"), "error");
            });
        }}
      />
    </div>
  );
}

export function DecisionDetail({
  decision,
  canWrite,
  canReview,
  onEdit,
  onDelete,
  onReview,
  reviewing,
}: {
  decision: Decision;
  canWrite: boolean;
  canReview: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReview: (status: Exclude<DecisionStatus, "proposed">) => void;
  reviewing?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <DecisionBadge status={decision.status} />
          <h2 className="mt-3 text-2xl font-semibold">{decision.title}</h2>
          <p className="mt-2 text-sm text-muted">Updated {formatDate(decision.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canWrite ? (
            <Button size="sm" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      {canReview ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={reviewing} size="sm" onClick={() => onReview("approved")}>
            Approve
          </Button>
          <Button
            disabled={reviewing}
            size="sm"
            variant="secondary"
            onClick={() => onReview("rejected")}
          >
            Reject
          </Button>
          <Button
            disabled={reviewing}
            size="sm"
            variant="ghost"
            onClick={() => onReview("superseded")}
          >
            Supersede
          </Button>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Your role can view this record. Review actions require triage or higher.
        </p>
      )}
      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-line bg-black/20 p-4">
          <h3 className="text-sm font-medium text-orange-300">Proposal</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{decision.proposalContent}</p>
        </section>
        <section className="rounded-xl border border-line bg-black/20 p-4">
          <h3 className="text-sm font-medium text-orange-300">Reasoning</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
            {decision.llmReasoningSummary || "No reasoning summary yet."}
          </p>
        </section>
      </div>
    </div>
  );
}
