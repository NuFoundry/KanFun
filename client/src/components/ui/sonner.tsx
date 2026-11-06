import { useTranslation } from "react-i18next";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts start below the sticky header (h-14), so they never cover the user menu, and each one
 * has a close button to dismiss it right away.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { t } = useTranslation();
  return (
    <Sonner
      className="toaster group"
      closeButton
      // Below the header and the iOS status bar / notch (env() is 0 elsewhere).
      offset={{ top: "calc(72px + env(safe-area-inset-top))", right: 24, bottom: 24, left: 24 }}
      mobileOffset={{
        top: "calc(64px + env(safe-area-inset-top))",
        right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        left: 16,
      }}
      toastOptions={{
        closeButtonAriaLabel: t("toast.close"),
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
