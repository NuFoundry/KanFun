import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiHealth } from "@/lib/api/ai";
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from "@/lib/api/conversations";

export const conversationKeys = {
  all: ["conversations"] as const,
  list: ["conversations", "list"] as const,
  detail: (id: string) => ["conversations", "detail", id] as const,
};

export function useConversations() {
  return useQuery({ queryKey: conversationKeys.list, queryFn: listConversations });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? ""),
    queryFn: () => getConversation(id!),
    enabled: Boolean(id),
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameConversation(id, title),
    // The open conversation shows its title in the header, so the detail query refetches too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationKeys.all }),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationKeys.all }),
  });
}

/** Whether the AI service can transcribe voice messages (decides if the mic is shown). */
export function useAiHealth() {
  return useQuery({ queryKey: ["ai", "health"], queryFn: aiHealth, staleTime: Infinity });
}
