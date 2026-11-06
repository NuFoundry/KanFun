import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { QrCode } from "@/components/qr-code";
import { LoadingRegion } from "@/components/skeletons";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useDisableTwoFactor,
  useEnableApp,
  useEnableEmail,
  useNewRecoveryCodes,
  useStartAppSetup,
  useStartEmailSetup,
  useTwoFactor,
} from "@/hooks/use-two-factor";
import { twoFactorProblem } from "@/lib/api/two-factor";
import { useAuth } from "@/lib/auth-context";

type Step = "app" | "email" | "disable" | "recovery" | null;

/** Settings → Two-factor authentication: turn it on with an app or email codes, or off. */
export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useTwoFactor();
  const [step, setStep] = useState<Step>(null);
  const close = () => setStep(null);

  return (
    <Card data-testid="two-factor">
      <CardHeader>
        <CardTitle>{t("twoFactor.title")}</CardTitle>
        <CardDescription>{t("twoFactor.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <LoadingRegion testId="two-factor-loading">
            <div className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-9 w-36" />
              </div>
            </div>
          </LoadingRegion>
        )}
        {isError && (
          <ErrorState
            error={error}
            title={t("twoFactor.loadFailed")}
            onRetry={() => void refetch()}
            testId="two-factor-error"
          />
        )}
        {data && !data.method && (
          <div className="space-y-3" data-testid="two-factor-off">
            <p className="text-sm text-muted-foreground">{t("twoFactor.off")}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep("app")} data-testid="two-factor-setup-app">
                <Smartphone /> {t("twoFactor.useApp")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("email")}
                data-testid="two-factor-setup-email"
              >
                <Mail /> {t("twoFactor.useEmail")}
              </Button>
            </div>
          </div>
        )}
        {data?.method && (
          <div className="space-y-3" data-testid="two-factor-on">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>
                <ShieldCheck /> {t("twoFactor.on")}
              </Badge>
              <span data-testid="two-factor-method">
                {data.method === "app" ? t("twoFactor.methodApp") : t("twoFactor.methodEmail")}
              </span>
            </div>
            {data.method === "app" && (
              <p className="text-sm text-muted-foreground" data-testid="two-factor-recovery-left">
                {data.recoveryCodes === 1
                  ? t("twoFactor.recoveryLeftOne")
                  : t("twoFactor.recoveryLeft", { count: data.recoveryCodes })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {data.method === "app" && (
                <Button
                  variant="outline"
                  onClick={() => setStep("recovery")}
                  data-testid="two-factor-new-codes"
                >
                  {t("twoFactor.newCodes")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setStep("disable")}
                data-testid="two-factor-disable"
              >
                {t("twoFactor.turnOff")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={step !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {step === "app" && <AppSetup onDone={close} />}
          {step === "email" && <EmailSetup onDone={close} />}
          {step === "disable" && <DisableTwoFactor onDone={close} />}
          {step === "recovery" && <RenewRecoveryCodes onDone={close} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Starts a setup step when its dialog opens, once (StrictMode mounts twice in development). */
function useOnce(start: () => void) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);
}

/** The fields the dialogs share: a code (when asked for) and the current password. */
function useConfirmForm(withCode: boolean) {
  const { t } = useTranslation();
  const schema = z.object({
    code: withCode ? z.string().trim().min(6, t("twoFactor.codeRequired")) : z.string(),
    password: z.string().min(1, t("validation.currentPassword")),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", password: "" },
  });

  /** Puts a failed request on the input it is about, or into a toast. */
  function showError(error: unknown) {
    const problem = twoFactorProblem(error);
    if (problem === "password")
      form.setError("password", { message: t("twoFactor.wrongPassword") });
    else if (problem === "code") form.setError("code", { message: t("twoFactor.wrongCode") });
    else toast.error(t("twoFactor.failed"));
  }
  return { form, showError };
}

function ConfirmFields({
  form,
  withCode,
  submit,
  pending,
  testId,
}: {
  form: ReturnType<typeof useConfirmForm>["form"];
  withCode: boolean;
  submit: (values: { code: string; password: string }) => Promise<void>;
  pending: boolean;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" data-testid={testId}>
        {withCode && (
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("twoFactor.code")}</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
        <Button type="submit" className="w-full" disabled={pending}>
          {t("twoFactor.confirm")}
        </Button>
      </form>
    </Form>
  );
}

function AppSetup({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const setup = useStartAppSetup();
  const enable = useEnableApp();
  const { form, showError } = useConfirmForm(true);
  const [codes, setCodes] = useState<string[] | null>(null);
  useOnce(setup.mutate);

  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />;

  async function submit(values: { code: string; password: string }) {
    try {
      setCodes(await enable.mutateAsync(values));
      toast.success(t("twoFactor.enabled"));
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("twoFactor.appTitle")}</DialogTitle>
        <DialogDescription>{t("twoFactor.appHint")}</DialogDescription>
      </DialogHeader>
      {setup.isPending && (
        <LoadingRegion testId="two-factor-qr-loading">
          <Skeleton className="mx-auto size-44" />
        </LoadingRegion>
      )}
      {setup.isError && (
        <ErrorState
          error={setup.error}
          title={t("twoFactor.failed")}
          onRetry={() => setup.mutate()}
          testId="two-factor-qr-error"
        />
      )}
      {setup.data && (
        <div className="space-y-2 text-center">
          <QrCode
            value={setup.data.uri}
            label={t("twoFactor.qrLabel")}
            className="mx-auto size-44"
          />
          <p className="text-xs text-muted-foreground">{t("twoFactor.cantScan")}</p>
          <div className="flex items-center justify-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs" data-testid="two-factor-secret">
              {setup.data.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
            <CopyButton text={setup.data.secret} />
          </div>
        </div>
      )}
      <ConfirmFields
        form={form}
        withCode
        submit={submit}
        pending={enable.isPending || !setup.data}
        testId="two-factor-app-form"
      />
    </>
  );
}

function EmailSetup({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const send = useStartEmailSetup();
  const enable = useEnableEmail();
  const { form, showError } = useConfirmForm(true);
  useOnce(send.mutate);

  async function submit(values: { code: string; password: string }) {
    try {
      await enable.mutateAsync({ ...values, otpId: send.data ?? "" });
      toast.success(t("twoFactor.enabled"));
      onDone();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("twoFactor.emailTitle")}</DialogTitle>
        <DialogDescription>
          {t("twoFactor.emailHint", { email: user?.email ?? "" })}
        </DialogDescription>
      </DialogHeader>
      {send.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("twoFactor.sendFailed")}
        </p>
      )}
      <ConfirmFields
        form={form}
        withCode
        submit={submit}
        pending={enable.isPending || !send.data}
        testId="two-factor-email-form"
      />
      <Button
        variant="link"
        className="mx-auto"
        disabled={send.isPending}
        onClick={() => send.mutate()}
      >
        {t("twoFactor.resend")}
      </Button>
    </>
  );
}

function DisableTwoFactor({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const disable = useDisableTwoFactor();
  const { form, showError } = useConfirmForm(false);

  async function submit({ password }: { password: string }) {
    try {
      await disable.mutateAsync(password);
      toast.success(t("twoFactor.disabled"));
      onDone();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("twoFactor.disableTitle")}</DialogTitle>
        <DialogDescription>{t("twoFactor.disableHint")}</DialogDescription>
      </DialogHeader>
      <ConfirmFields
        form={form}
        withCode={false}
        submit={submit}
        pending={disable.isPending}
        testId="two-factor-disable-form"
      />
    </>
  );
}

function RenewRecoveryCodes({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const renew = useNewRecoveryCodes();
  const { form, showError } = useConfirmForm(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />;

  async function submit({ password }: { password: string }) {
    try {
      setCodes(await renew.mutateAsync(password));
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("twoFactor.newCodesTitle")}</DialogTitle>
        <DialogDescription>{t("twoFactor.newCodesHint")}</DialogDescription>
      </DialogHeader>
      <ConfirmFields
        form={form}
        withCode={false}
        submit={submit}
        pending={renew.isPending}
        testId="two-factor-codes-form"
      />
    </>
  );
}

/** Shown once: the codes are stored only as hashes. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("twoFactor.codesTitle")}</DialogTitle>
        <DialogDescription>{t("twoFactor.codesHint")}</DialogDescription>
      </DialogHeader>
      <ul
        className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm"
        data-testid="two-factor-codes"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <DialogFooter className="gap-2">
        <CopyButton text={codes.join("\n")} label={t("twoFactor.copyCodes")} />
        <Button onClick={onDone} data-testid="two-factor-codes-done">
          {t("twoFactor.savedCodes")}
        </Button>
      </DialogFooter>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label?: ReactNode }) {
  const { t } = useTranslation();
  async function copy() {
    await navigator.clipboard.writeText(text);
    toast.success(t("twoFactor.copied"));
  }
  return (
    <Button variant="outline" size={label ? "default" : "icon"} onClick={() => void copy()}>
      <Copy />
      {label ?? <span className="sr-only">{t("twoFactor.copy")}</span>}
    </Button>
  );
}
