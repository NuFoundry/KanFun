import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAuth } from "@/lib/auth-context";
import { applyServerErrors } from "@/lib/form-errors";

/** "Forgot password?" flow: PocketBase emails a reset link (see server/pb_hooks/mail.pb.js). */
export function ForgotPasswordDialog() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const [open, setOpen] = useState(false);
  const schema = z.object({ email: z.email(t("validation.email")) });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    try {
      await requestPasswordReset(values.email);
      toast.success(t("forgot.sent"));
      form.reset();
      setOpen(false);
    } catch (error) {
      const message = applyServerErrors(error, (name, err) => form.setError(name as "email", err));
      if (message) toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          data-testid="forgot-password"
        >
          {t("forgot.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("forgot.title")}</DialogTitle>
          <DialogDescription>{t("forgot.subtitle")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            data-testid="reset-form"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("forgot.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {t("forgot.submit")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
