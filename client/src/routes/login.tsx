import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { ForgotPasswordDialog } from "@/components/forgot-password-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwoFactorChallenge } from "@/components/two-factor-challenge";
import { mfaIdFrom } from "@/lib/api/two-factor";
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-errors";

export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  // Set when the password was right and the account wants its second factor.
  const [mfaId, setMfaId] = useState<string | null>(null);
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  // The website's sign-up buttons link to /login?tab=register.
  const tab = new URLSearchParams(location.search).get("tab") === "register" ? "register" : "login";

  // Schemas live inside the component so validation messages follow the current language.
  const loginSchema = z.object({
    email: z.email(t("validation.email")),
    password: z.string().min(8, t("validation.password")),
  });
  const registerSchema = loginSchema.extend({ name: z.string().min(2, t("validation.name")) });
  type LoginValues = z.infer<typeof loginSchema>;
  type RegisterValues = z.infer<typeof registerSchema>;

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;
  if (mfaId) {
    return (
      <div className="mx-auto max-w-md">
        <TwoFactorChallenge mfaId={mfaId} onCancel={() => setMfaId(null)} />
      </div>
    );
  }

  async function run(
    action: () => Promise<void>,
    successMessage: string,
    setError: Parameters<typeof applyServerErrors>[1],
  ) {
    setSubmitting(true);
    try {
      await action();
      toast.success(successMessage);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const pending = mfaIdFrom(error);
      if (pending) return setMfaId(pending);
      const message = applyServerErrors(error, setError);
      if (message) toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Tabs defaultValue={tab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("login.tabLogin")}</TabsTrigger>
          <TabsTrigger value="register" data-testid="tab-register">
            {t("login.tabRegister")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>{t("login.welcome")}</CardTitle>
              <CardDescription>{t("login.welcomeSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...loginForm}>
                <form
                  data-testid="login-form"
                  className="space-y-4"
                  onSubmit={loginForm.handleSubmit((values) =>
                    run(
                      () => login(values.email, values.password),
                      t("login.signedIn"),
                      (name, err) => loginForm.setError(name as "email" | "password", err),
                    ),
                  )}
                >
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("login.email")}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("login.password")}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="current-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {t("login.submit")}
                  </Button>
                  <div className="text-center">
                    <ForgotPasswordDialog />
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>{t("login.createTitle")}</CardTitle>
              <CardDescription>{t("login.createSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...registerForm}>
                <form
                  data-testid="register-form"
                  className="space-y-4"
                  onSubmit={registerForm.handleSubmit((values) =>
                    run(
                      () => register(values),
                      t("login.created"),
                      (name, err) =>
                        registerForm.setError(name as "name" | "email" | "password", err),
                    ),
                  )}
                >
                  <FormField
                    control={registerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("login.name")}</FormLabel>
                        <FormControl>
                          <Input autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("login.email")}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("login.password")}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {t("login.create")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
