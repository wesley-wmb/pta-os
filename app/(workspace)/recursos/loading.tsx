import { Skeleton } from '@/components/ui/skeleton';

export default function ResourcesLoading() {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-4 h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-[520px] max-w-full" />
      <div className="mt-8 rounded-[28px] bg-[#101824] p-7">
        <Skeleton className="h-12 w-[720px] max-w-full rounded-2xl bg-white/10" />
        <Skeleton className="mt-3 h-4 w-56 bg-white/10" />
      </div>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="rounded-2xl border p-3">
          <Skeleton className="m-2 h-5 w-24" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="mt-2 h-11 w-full rounded-xl" />
          ))}
        </div>
        <div>
          <Skeleton className="h-5 w-40" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-5 w-44" />
          <div className="mt-3 overflow-hidden rounded-2xl border p-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="mt-2 h-14 w-full first:mt-0" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
