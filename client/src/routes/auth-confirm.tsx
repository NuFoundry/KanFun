/**
 * Where the links in auth emails lead (/auth/confirm-verification/:token,
 * /auth/confirm-password-reset/:token, /auth/confirm-email-change/:token). PocketBase's own pages
 * live in its admin UI under /_/, which production keeps off the internet (deploy/Caddyfile), so
 * the app answers these links itself; server/pb_hooks/mail.pb.js points the emails here.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { z } from "zod";
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
import { confirmEmailChange, confirmPasswordReset, confirmVerification } from "@/lib/api/users";
import { useAuth } from "@/lib/auth-context";

export function ConfirmVerificationPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  // StrictMode runs effects twice; a token can only be redeemed once.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    confirmVerification(token).then(
      () => setState("done"),
      () => setState("failed"),
    );
  }, [token]);

  const message =
    state === "done"
      ? t("authConfirm.verifyDone")
      : state === "failed"
        ? t("authConfirm.invalidLink")
        : t("authConfirm.verifyWorking");
  return (
    <div className="mx-auto max-w-md">
      <Card data-testid="confirm-verification" data-state={state}>
        <CardHeader>
          <CardTitle>{t("authConfirm.verifyTitle")}</CardTitle>
          <CardDescription role={state === "failed" ? "alert" : undefined}>
            {message}
          </CardDescription>
        </CardHeader>
        {state !== "working" && (
          <CardContent>
            <Button asChild>
              <Link to={user ? "/dashboard" : "/login"}>
                {user ? t("authConfirm.toApp") : t("authConfirm.toLogin")}
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  // Inside the component so the messages follow the language.
  const schema = z
    .object({
      password: z.string().min(8, t("validation.password")),
      passwordConfirm: z.string(),
    })
    .refine((values) => values.password === values.passwordConfirm, {
      message: t("validation.passwordMatch"),
      path: ["passwordConfirm"],
    });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  async function onSubmit(values: Values) {
    setFailed(false);
    try {
      await confirmPasswordReset(token, values.password);
      setDone(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("authConfirm.resetTitle")}</CardTitle>
          <CardDescription>
            {done ? t("authConfirm.resetDone") : t("authConfirm.resetHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <Button asChild>
              <Link to="/login" data-testid="reset-to-login">
                {t("authConfirm.toLogin")}
              </Link>
            </Button>
          ) : (
            <Form {...form}>
              <form
                data-testid="new-password-form"
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                {failed && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("authConfirm.invalidLink")}
                  </p>
                )}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {t("authConfirm.resetSubmit")}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ConfirmEmailChangePage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const schema = z.object({ password: z.string().min(1, t("validation.currentPassword")) });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  async function onSubmit(values: Values) {
    setFailed(false);
    try {
      await confirmEmailChange(token, values.password);
      setDone(true);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("authConfirm.emailTitle")}</CardTitle>
          <CardDescription>
            {done ? t("authConfirm.emailDone") : t("authConfirm.emailHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <Button asChild>
              <Link to="/login">{t("authConfirm.toLogin")}</Link>
            </Button>
          ) : (
            <Form {...form}>
              <form
                data-testid="email-change-form"
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="password"
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
                {failed && (
                  <p role="alert" className="text-sm text-destructive">
                    {t("authConfirm.emailFailed")}
                  </p>
                )}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {t("authConfirm.emailSubmit")}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
