import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AttachmentError,
  kindOf,
  MAX_FILES,
  readAttachment,
  type Attachment,
} from "@/lib/attachments";

/** A file in the composer: read, or still being read (no content yet). */
export type PendingFile = Attachment & { id: string; reading?: boolean };

let counter = 0;

/**
 * The files that go with the next message. `add` reads each in the browser (it shows while it is
 * read) and says in a toast why one cannot be attached; `restore` puts files back after a send
 * that failed.
 */
export function useAttachments() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<PendingFile[]>([]);
  // Two quick drops must not both see room for five.
  const count = useRef(0);
  const update = (next: (previous: PendingFile[]) => PendingFile[]) =>
    setFiles((previous) => {
      const result = next(previous);
      count.current = result.length;
      return result;
    });

  function add(list: File[]) {
    const room = MAX_FILES - count.current;
    if (list.length > room) toast.error(t("assistant.files.tooMany", { max: MAX_FILES }));
    for (const file of list.slice(0, Math.max(0, room))) {
      const kind = kindOf(file);
      if (!kind) {
        toast.error(t("assistant.files.type", { name: file.name }));
        continue;
      }
      const id = `file-${++counter}`;
      count.current += 1;
      update((previous) => [
        ...previous,
        { id, name: file.name, kind, size: file.size, reading: true },
      ]);
      readAttachment(file).then(
        (read) => update((previous) => previous.map((f) => (f.id === id ? { ...read, id } : f))),
        (error: unknown) => {
          const problem = error instanceof AttachmentError ? error.problem : "unreadable";
          toast.error(
            problem === "type"
              ? t("assistant.files.type", { name: file.name })
              : problem === "size"
                ? t("assistant.files.size", { name: file.name })
                : problem === "empty"
                  ? t("assistant.files.empty", { name: file.name })
                  : t("assistant.files.unreadable", { name: file.name }),
          );
          update((previous) => previous.filter((f) => f.id !== id));
        },
      );
    }
  }

  return {
    files,
    reading: files.some((file) => file.reading),
    add,
    remove: (id: string) => update((previous) => previous.filter((file) => file.id !== id)),
    clear: () => update(() => []),
    restore: (previous: PendingFile[]) => update(() => previous),
  };
}
