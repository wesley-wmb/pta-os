export default function LoadingPeek() {
  return (
    <div className="px-5 py-7 sm:px-7" role="status" aria-busy="true">
      <span className="sr-only">Carregando tarefa…</span>
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-9 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
