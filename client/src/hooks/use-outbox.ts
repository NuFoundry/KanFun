import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearOutbox, listOutbox } from "@/lib/api/mail";

const outboxKey = ["outbox"] as const;

/** Polls the dev outbox so new mail shows up while you click through the app. */
export function useOutbox(to: string) {
  return useQuery({
    queryKey: [...outboxKey, to],
    queryFn: () => listOutbox({ to }),
    refetchInterval: 2000,
    staleTime: 0,
  });
}

export function useClearOutbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearOutbox,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: outboxKey }),
  });
}
