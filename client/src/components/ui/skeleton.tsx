import { cn } from "@/lib/utils";

/** A placeholder bar. Decorative: the surrounding LoadingRegion carries the accessible state. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-primary/10 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
