import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disableTwoFactor,
  enableApp,
  enableEmail,
  getTwoFactor,
  newRecoveryCodes,
  startAppSetup,
  startChallenge,
  startEmailSetup,
} from "@/lib/api/two-factor";

const KEY = ["two-factor"];

export function useTwoFactor() {
  return useQuery({ queryKey: KEY, queryFn: getTwoFactor });
}

/** A change to the user's two-factor settings; the status refetches afterwards. */
function useChange<I, R>(mutationFn: (input: I) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export const useStartAppSetup = () => useMutation({ mutationFn: startAppSetup });
export const useStartEmailSetup = () => useMutation({ mutationFn: startEmailSetup });

export const useEnableApp = () =>
  useChange(({ password, code }: { password: string; code: string }) => enableApp(password, code));

export const useEnableEmail = () =>
  useChange(({ password, otpId, code }: { password: string; otpId: string; code: string }) =>
    enableEmail(password, otpId, code),
  );

export const useDisableTwoFactor = () => useChange(disableTwoFactor);
export const useNewRecoveryCodes = () => useChange(newRecoveryCodes);

/**
 * The second step of a sign-in. Asked once per sign-in (for email it sends the code);
 * refetch() sends a new one.
 */
export function useChallenge(mfaId: string) {
  return useQuery({
    queryKey: ["two-factor-challenge", mfaId],
    queryFn: () => startChallenge(mfaId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
