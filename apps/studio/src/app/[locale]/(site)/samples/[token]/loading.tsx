import { Skeleton } from "@/components/ui/skeleton";

/** Branded loader for a single sample book page (header + book preview). */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
      role="status"
      aria-label="Loading sample book"
    >
      <div className="mb-10 flex flex-col items-center">
        <Skeleton className="h-4 w-28" rounded="rounded-full" />
        <Skeleton className="mt-4 h-9 w-2/3 max-w-md" />
        <Skeleton className="mt-3 h-4 w-40" />
      </div>
      <Skeleton className="mx-auto aspect-[3/2] w-full max-w-3xl" rounded="rounded-[2rem]" />
    </div>
  );
}
