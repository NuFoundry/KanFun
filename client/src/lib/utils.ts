import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `count` items rendered by `render(index)`; used for skeleton rows (placeholders never reorder). */
export function repeat<T>(count: number, render: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => render(index));
}
