import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  checkConsent,
  createToken,
  decideConsent,
  listActivity,
  listGrants,
  revokeGrant,
  type AuthorizationRequest,
  type Scope,
} from "@/lib/api/mcp";

export const mcpKeys = {
  all: ["mcp"] as const,
  grants: ["mcp", "grants"] as const,
  activity: ["mcp", "activity"] as const,
  consent: (request: AuthorizationRequest) => ["mcp", "consent", request] as const,
};

export function useGrants() {
  return useQuery({ queryKey: mcpKeys.grants, queryFn: listGrants });
}

export function useMcpActivity() {
  return useQuery({ queryKey: mcpKeys.activity, queryFn: () => listActivity() });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeGrant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.all }),
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpKeys.grants }),
  });
}

/** Checked once per request: retrying a refused one would only repeat the refusal. */
export function useConsentRequest(request: AuthorizationRequest) {
  return useQuery({
    queryKey: mcpKeys.consent(request),
    queryFn: () => checkConsent(request),
    retry: false,
    staleTime: Infinity,
  });
}

export function useDecideConsent(request: AuthorizationRequest) {
  return useMutation({
    mutationFn: ({ approve, scopes }: { approve: boolean; scopes: Scope[] }) =>
      decideConsent(request, approve, scopes),
  });
}

/** What each permission means, as the consent page and Settings show it. */
export function useScopeLabels(): Record<Scope, string> {
  const { t } = useTranslation();
  return {
    "posts:read": t("mcp.scope.postsRead"),
    "posts:write": t("mcp.scope.postsWrite"),
    "posts:delete": t("mcp.scope.postsDelete"),
  };
}
