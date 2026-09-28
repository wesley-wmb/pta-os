import { Skeleton } from '@/components/ui/skeleton';

export default function ApiSettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-12 w-full max-w-2xl" />
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,760px)]">
        <Skeleton className="h-64" />
        <Skeleton className="h-[520px]" />
      </div>
    </div>
  );
}
