import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-10 w-52" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg" />
      <div className="mt-12 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex items-center gap-4 lg:block">
          <Skeleton className="size-20 rounded-full" />
          <div className="lg:mt-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
        <div className="space-y-7">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
      <span className="sr-only">Carregando perfil</span>
    </main>
  );
}
