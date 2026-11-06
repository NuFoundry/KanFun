import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { LoadingRegion } from "@/components/skeletons";
import { ErrorState } from "@/components/states";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useChallenge } from "@/hooks/use-two-factor";
import { twoFactorProblem, verifyAppCode, verifyEmailCode } from "@/lib/api/two-factor";

/**
 * The second step of a sign-in for users with two-factor on: a code from the authenticator app
 * (or a recovery code), or the code just emailed. Success stores the session; the login page
 * then redirects.
 */
export function TwoFactorChallenge({ mfaId, onCancel }: { mfaId: string; onCancel: () => void }) {
  const { t } = useTranslation();
  const { data: challenge, isLoading, isError, error, refetch, isFetching } = useChallenge(mfaId);
  const [recovery, setRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const schema = z.object({ code: z.string().trim().min(6, t("twoFactor.codeRequired")) });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: "" } });

  async function submit({ code }: Values) {
    if (!challenge) return;
    setSubmitting(true);
    try {
      if (challenge.method === "email") await verifyEmailCode(mfaId, challenge.otpId ?? "", code);
      else await verifyAppCode(mfaId, code);
      toast.success(t("login.signedIn"));
    } catch (err) {
      const problem = twoFactorProblem(err);
      if (problem === "code") form.setError("code", { message: t("twoFactor.wrongCode") });
      else if (problem === "signIn") {
        toast.error(t("twoFactor.expired"));
        onCancel();
      } else toast.error(t("twoFactor.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    const { isSuccess } = await refetch();
    if (isSuccess) toast.success(t("twoFactor.resent"));
  }

  return (
    <Card data-testid="two-factor-challenge">
      <CardHeader>
        <CardTitle>{t("twoFactor.title")}</CardTitle>
        <CardDescription>
          {challenge?.method === "email"
            ? t("twoFactor.challengeEmail")
            : recovery
              ? t("twoFactor.challengeRecovery")
              : t("twoFactor.challengeApp")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <LoadingRegion testId="two-factor-challenge-loading">
            <div className="space-y-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </LoadingRegion>
        )}
        {isError && (
          <ErrorState
            error={error}
            title={
              twoFactorProblem(error) === "signIn" ? t("twoFactor.expired") : t("twoFactor.failed")
            }
            onRetry={onCancel}
            testId="two-factor-challenge-error"
          />
        )}
        {challenge && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(submit)}
              className="space-y-4"
              data-testid="two-factor-challenge-form"
            >
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {recovery ? t("twoFactor.recoveryCode") : t("twoFactor.code")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoFocus
                        inputMode={recovery ? "text" : "numeric"}
                        autoComplete="one-time-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {t("twoFactor.verify")}
              </Button>
            </form>
          </Form>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="link" className="px-0" onClick={onCancel}>
            {t("twoFactor.back")}
          </Button>
          {challenge?.method === "app" && (
            <Button
              variant="link"
              className="px-0"
              onClick={() => {
                setRecovery(!recovery);
                form.reset();
              }}
              data-testid="two-factor-use-recovery"
            >
              {recovery ? t("twoFactor.useAppCode") : t("twoFactor.useRecovery")}
            </Button>
          )}
          {challenge?.method === "email" && (
            <Button
              variant="link"
              className="px-0"
              disabled={isFetching}
              onClick={() => void resend()}
            >
              {t("twoFactor.resend")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
