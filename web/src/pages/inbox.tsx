import { Link } from "react-router-dom";
import { Button, Card, PageHeader, StatePanel } from "../components/ui";
import { useToast } from "../components/toasts";
import { errorMessage } from "../lib/api";
import { formatDate, isInvitationActionable } from "../lib/format";
import {
  useMarkNotificationRead,
  useNotifications,
  useRespondToInvitation,
} from "../lib/resources";

export function InboxPage() {
  const notifications = useNotifications();
  const respond = useRespondToInvitation();
  const markRead = useMarkNotificationRead();
  const { notify } = useToast();

  async function onRespond(invitationId: string, action: "accept" | "decline") {
    try {
      await respond.mutateAsync({ invitationId, action });
      notify(action === "accept" ? "Invitation accepted" : "Invitation declined", "success");
    } catch (error) {
      notify(errorMessage(error, "Unable to update invitation"), "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Workspace"
        title="Inbox"
        description="Project invitations and activity appear here. Accepting an invite is required before you join a team."
      />
      {notifications.isPending ? (
        <StatePanel loading title="Loading inbox" />
      ) : notifications.isError ? (
        <StatePanel
          title="Unable to load notifications"
          description={errorMessage(notifications.error, "Please try again.")}
        />
      ) : notifications.data.length === 0 ? (
        <StatePanel
          title="Inbox is empty"
          description="When someone invites you to a project, it will show up here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.data.map((item) => {
            const actionable = isInvitationActionable(
              item.invitationStatus,
              item.invitationExpiresAt,
            );
            return (
              <Card className="p-5" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {item.payload.inviterName} invited you to {item.payload.projectTitle}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Requested role: {item.payload.requestedRole} · {formatDate(item.createdAt)}
                      {item.readAt ? "" : " · Unread"}
                    </p>
                    {item.invitationStatus && item.invitationStatus !== "pending" ? (
                      <p className="mt-2 text-sm capitalize text-muted">
                        Status: {item.invitationStatus}
                      </p>
                    ) : null}
                    {item.invitationStatus === "pending" && !actionable ? (
                      <p className="mt-2 text-sm text-amber-300">This invitation has expired.</p>
                    ) : null}
                  </div>
                  {item.projectId && item.invitationStatus === "accepted" ? (
                    <Link to={`/app/projects/${item.projectId}`}>
                      <Button size="sm" variant="secondary">Open project</Button>
                    </Link>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {actionable && item.invitationId ? (
                    <>
                      <Button
                        disabled={respond.isPending}
                        size="sm"
                        onClick={() => void onRespond(item.invitationId!, "accept")}
                      >
                        Accept
                      </Button>
                      <Button
                        disabled={respond.isPending}
                        size="sm"
                        variant="secondary"
                        onClick={() => void onRespond(item.invitationId!, "decline")}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                  {!item.readAt ? (
                    <Button
                      disabled={markRead.isPending}
                      size="sm"
                      variant="ghost"
                      onClick={() => void markRead.mutateAsync(item.id).catch((error) => {
                        notify(errorMessage(error, "Unable to mark as read"), "error");
                      })}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
