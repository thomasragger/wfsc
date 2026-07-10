import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

/** Branded loader for an occasion category page (hero band + card grid). */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading stories">
      <section className="flip-wash">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <Skeleton className="h-6 w-32" rounded="rounded-full" />
          <Skeleton className="mt-5 h-10 w-3/4 max-w-xl" />
          <Skeleton className="mt-4 h-5 w-2/3 max-w-md" />
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <SkeletonGrid
          count={8}
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4"
          itemClassName="aspect-square w-full"
        />
      </section>
    </div>
  );
}
