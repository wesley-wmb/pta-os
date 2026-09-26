export default function ProjectLoading() {
  return (
    <div className="px-4 py-6 sm:px-6" aria-label="Carregando projeto">
      <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="mt-5 h-12 max-w-xl animate-pulse rounded-xl bg-muted" />
      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse bg-card" />
        ))}
      </div>
      <div className="mt-8 h-12 animate-pulse rounded-xl bg-muted" />
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-muted/70" />
    </div>
  );
}
