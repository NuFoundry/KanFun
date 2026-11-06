import { useMutation } from "@tanstack/react-query";
import {
  changePassword,
  updateProfile,
  type PasswordInput,
  type ProfileInput,
} from "@/lib/api/users";

/** The auth context picks the new record up from pb.authStore; nothing to invalidate. */
export function useUpdateProfile(userId: string) {
  return useMutation({ mutationFn: (input: ProfileInput) => updateProfile(userId, input) });
}

export function useChangePassword(userId: string, email: string) {
  return useMutation({
    mutationFn: (input: PasswordInput) => changePassword(userId, email, input),
  });
}
