import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { ConfirmationDialog, Dialog } from "../components/dialog";
import {
  Button,
  Card,
  Field,
  Input,
  InvitationBadge,
  PageHeader,
  RoleBadge,
  Select,
  StatePanel,
} from "../components/ui";
import { useToast } from "../components/toasts";
import { errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { can, projectRoles, type ProjectRole } from "../lib/permissions";
import {
  useInviteMember,
  useInvitations,
  useMembers,
  useProject,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMember,
} from "../lib/resources";

export function TeamPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const members = useMembers(projectId);
  const canMaintain = can(project.data?.role, "maintain");
  const invitations = useInvitations(projectId, canMaintain);
  const invite = useInviteMember(projectId);
  const revoke = useRevokeInvitation(projectId);
  const updateMember = useUpdateMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const { notify } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("write");
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);

  const assignableRoles = projectRoles.filter(
    (value) => value !== "admin" || can(project.data?.role, "admin"),
  );

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await invite.mutateAsync({ email: email.trim(), role });
      notify("Invitation sent", "success");
      setInviteOpen(false);
      setEmail("");
      setRole("write");
    } catch (error) {
      notify(
        errorMessage(
          error,
          "Invitation cannot be created. The person must already have a Mindvault account.",
        ),
        "error",
      );
    }
  }

  if (project.isPending || members.isPending) {
    return <StatePanel loading title="Loading team" />;
  }
  if (project.isError || members.isError || !project.data) {
    return (
      <StatePanel
        title="Unable to load team"
        description={errorMessage(project.error ?? members.error, "Try again shortly.")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Team"
        title="Members and invitations"
        description="Invite a registered user by email. They must accept before becoming a member."
        actions={
          canMaintain ? (
            <Button onClick={() => setInviteOpen(true)}>Invite by email</Button>
          ) : null
        }
      />
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Members</h2>
        <div className="space-y-3">
          {members.data?.map((member) => {
            const owner = member.userId === project.data.ownerUserId;
            const adminLocked = member.role === "admin" && !can(project.data.role, "admin");
            const canEdit = canMaintain && !owner && !adminLocked;
            return (
              <div
                className="flex flex-col gap-3 rounded-xl border border-line bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={member.userId}
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <Select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(event) => {
                        void updateMember
                          .mutateAsync({
                            userId: member.userId,
                            role: event.target.value as ProjectRole,
                          })
                          .then(() => notify("Role updated", "success"))
                          .catch((error) => {
                            notify(errorMessage(error, "Unable to update role"), "error");
                          });
                      }}
                    >
                      {assignableRoles.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                  {owner ? <span className="text-xs text-orange-300">Owner</span> : null}
                  {canEdit ? (
                    <Button size="sm" variant="ghost" onClick={() => setRemoveUserId(member.userId)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {canMaintain ? (
        <Card className="mt-5 p-5">
          <h2 className="mb-4 text-lg font-semibold">Pending invitations</h2>
          {invitations.isPending ? (
            <StatePanel loading title="Loading invitations" />
          ) : invitations.isError ? (
            <StatePanel
              title="Unable to load invitations"
              description={errorMessage(invitations.error, "Maintain permission is required.")}
            />
          ) : (invitations.data ?? []).filter((item) => item.status === "pending").length === 0 ? (
            <StatePanel
              title="No pending invitations"
              description="Invite a registered teammate by email. There is no user directory to search."
            />
          ) : (
            <div className="space-y-3">
              {invitations.data
                ?.filter((item) => item.status === "pending")
                .map((item) => (
                  <div
                    className="flex flex-col gap-3 rounded-xl border border-line bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={item.id}
                  >
                    <div>
                      <p className="font-medium">{item.inviteeName}</p>
                      <p className="text-sm text-muted">
                        {item.inviteeEmail} · {item.requestedRole} · expires {formatDate(item.expiresAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <InvitationBadge status={item.status} />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void revoke
                            .mutateAsync(item.id)
                            .then(() => notify("Invitation revoked", "success"))
                            .catch((error) => {
                              notify(errorMessage(error, "Unable to revoke invitation"), "error");
                            });
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      ) : null}
      <Dialog
        open={inviteOpen}
        title="Invite by email"
        description="The invitee must already have a Mindvault account. They join only after accepting."
        onClose={() => setInviteOpen(false)}
      >
        <form className="space-y-4" onSubmit={onInvite}>
          <Field label="Email">
            <Input
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as ProjectRole)}
            >
              {assignableRoles.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={invite.isPending} type="submit">
              Send invite
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmationDialog
        confirmLabel="Remove"
        description="This person will lose access until they are invited again and accept."
        open={Boolean(removeUserId)}
        title="Remove this member?"
        onClose={() => setRemoveUserId(null)}
        onConfirm={() => {
          if (!removeUserId) return;
          void removeMember
            .mutateAsync(removeUserId)
            .then(() => {
              notify("Member removed", "success");
              setRemoveUserId(null);
            })
            .catch((error) => {
              notify(errorMessage(error, "Unable to remove member"), "error");
            });
        }}
      />
    </div>
  );
}
