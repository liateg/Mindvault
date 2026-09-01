import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { queryKeys } from "./query";
import type { ProjectRole } from "./permissions";
import type {
  Decision,
  DecisionStatus,
  NotificationItem,
  Project,
  ProjectInvitation,
  ProjectMember,
  UnreadCount,
} from "./types";

const NOTIFICATION_POLL_MS = 15_000;
const pollInterval =
  import.meta.env.MODE === "test" ? false : NOTIFICATION_POLL_MS;

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => api.get<Project[]>("/api/projects", signal),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => api.get<Project>(`/api/projects/${projectId}`, signal),
  });
}

export function useDecisions(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.decisions(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      api.get<Decision[]>(`/api/projects/${projectId}/decisions`, signal),
  });
}

export function useMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      api.get<ProjectMember[]>(`/api/projects/${projectId}/members`, signal),
  });
}

export function useInvitations(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.invitations(projectId ?? ""),
    enabled: Boolean(projectId) && enabled,
    queryFn: ({ signal }) =>
      api.get<ProjectInvitation[]>(
        `/api/projects/${projectId}/invitations`,
        signal,
      ),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) =>
      api.get<NotificationItem[]>("/api/notifications", signal),
    refetchInterval: pollInterval,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notificationCount,
    queryFn: async ({ signal }) => {
      const result = await api.get<UnreadCount>(
        "/api/notifications/unread-count",
        signal,
      );
      return { count: Number(result.count) || 0 };
    },
    refetchInterval: pollInterval,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string }) =>
      api.post<Project>("/api/projects", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; description?: string | null }) =>
      api.patch<Project>(`/api/projects/${projectId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.project(projectId),
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.delete(`/api/projects/${projectId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useCreateDecision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      proposalContent: string;
      llmReasoningSummary?: string;
    }) => api.post<Decision>(`/api/projects/${projectId}/decisions`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.decisions(projectId),
      });
    },
  });
}

export function useUpdateDecision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      decisionId,
      body,
    }: {
      decisionId: string;
      body: {
        title?: string;
        proposalContent?: string;
        llmReasoningSummary?: string | null;
      };
    }) =>
      api.patch<Decision>(
        `/api/projects/${projectId}/decisions/${decisionId}`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.decisions(projectId),
      });
    },
  });
}

export function useReviewDecision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      decisionId,
      status,
    }: {
      decisionId: string;
      status: Exclude<DecisionStatus, "proposed">;
    }) =>
      api.post<Decision>(
        `/api/projects/${projectId}/decisions/${decisionId}/review`,
        { status },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.decisions(projectId),
      });
    },
  });
}

export function useDeleteDecision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisionId: string) =>
      api.delete(`/api/projects/${projectId}/decisions/${decisionId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.decisions(projectId),
      });
    },
  });
}

export function useInviteMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: ProjectRole }) =>
      api.post<ProjectInvitation>(
        `/api/projects/${projectId}/invitations`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(projectId),
      });
    },
  });
}

export function useRevokeInvitation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.post(
        `/api/projects/${projectId}/invitations/${invitationId}/revoke`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(projectId),
      });
    },
  });
}

export function useUpdateMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      api.patch<ProjectMember>(
        `/api/projects/${projectId}/members/${userId}`,
        { role },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.members(projectId),
      });
    },
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.members(projectId),
      });
    },
  });
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      invitationId,
      action,
    }: {
      invitationId: string;
      action: "accept" | "decline";
    }) => api.post(`/api/invitations/${invitationId}/${action}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationCount,
      });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.patch(`/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notificationCount,
      });
    },
  });
}
