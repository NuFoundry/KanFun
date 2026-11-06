import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { StoredFile } from "@/lib/api/conversations";
import type { Attachment } from "@/lib/attachments";
import { cn } from "@/lib/utils";

/**
 * An attached file: a thumbnail for images, an icon otherwise, removable in the composer. In a
 * reopened chat the content is gone (only names are saved), which the chip says on hover.
 */
export function FileChip({
  file,
  reading = false,
  onRemove,
}: {
  file: StoredFile & Partial<Attachment>;
  reading?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const gone = !reading && !file.text && !file.image;
  const Icon = file.kind === "image" ? ImageIcon : FileText;
  return (
    <div
      className={cn(
        "flex h-10 max-w-56 items-center gap-2 rounded-lg border bg-card py-1 pr-2 pl-1 text-xs",
        gone && "opacity-60",
      )}
      title={gone ? t("assistant.files.gone") : file.name}
      aria-busy={reading || undefined}
      data-testid="file-chip"
    >
      {file.image ? (
        <img
          src={`data:${file.image.mediaType};base64,${file.image.data}`}
          alt=""
          className="size-8 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        </span>
      )}
      <span className="min-w-0 truncate font-medium">{file.name}</span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded-full"
          onClick={onRemove}
          aria-label={t("assistant.files.remove", { name: file.name })}
          data-testid="file-remove"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
