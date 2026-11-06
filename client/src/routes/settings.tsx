import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { ConnectedApps, McpActivity } from "@/components/connected-apps";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-profile";
import { nameParts } from "@/lib/api/users";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-errors";

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const email = user?.email ?? "";

  const profileSchema = z.object({
    firstName: z.string().trim().min(1, t("validation.firstName")).max(100),
    lastName: z.string().trim().min(1, t("validation.lastName")).max(100),
  });
  const passwordSchema = z
    .object({
      oldPassword: z.string().min(1, t("validation.currentPassword")),
      password: z.string().min(8, t("validation.password")),
      passwordConfirm: z.string(),
    })
    .refine((v) => v.password === v.passwordConfirm, {
      message: t("validation.passwordMatch"),
      path: ["passwordConfirm"],
    });
  type ProfileValues = z.infer<typeof profileSchema>;
  type PasswordValues = z.infer<typeof passwordSchema>;

  const updateProfile = useUpdateProfile(userId);
  const changePassword = useChangePassword(userId, email);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: nameParts(user ?? {}),
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: "", password: "", passwordConfirm: "" },
  });

  async function saveProfile(values: ProfileValues) {
    try {
      await updateProfile.mutateAsync(values);
      toast.success(t("settings.profileSaved"));
    } catch (error) {
      const message = applyServerErrors(
        error,
        (name, err) => profileForm.setError(name as keyof ProfileValues, err),
        ["firstName", "lastName"],
      );
      if (message) toast.error(message);
    }
  }

  async function savePassword(values: PasswordValues) {
    try {
      await changePassword.mutateAsync(values);
      toast.success(t("settings.passwordChanged"));
      passwordForm.reset();
    } catch (error) {
      const message = applyServerErrors(
        error,
        (name, err) => passwordForm.setError(name as keyof PasswordValues, err),
        ["oldPassword", "password", "passwordConfirm"],
      );
      if (message) toast.error(message);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
          <CardDescription>{t("settings.profileHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit(saveProfile)}
              className="space-y-4"
              data-testid="profile-form"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.firstName")}</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("settings.lastName")}</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {t("settings.saveProfile")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.password")}</CardTitle>
          <CardDescription>{t("settings.passwordHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(savePassword)}
              className="space-y-4"
              data-testid="password-form"
            >
              <FormField
                control={passwordForm.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.currentPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.newPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="passwordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("settings.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending}>
                {t("settings.changePassword")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <TwoFactorSettings />

      <ConnectedApps />
      <McpActivity />
    </section>
  );
}
