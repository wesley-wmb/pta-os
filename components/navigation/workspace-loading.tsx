export function WorkspaceLoading({
  label = 'Carregando página',
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 px-5 py-6 sm:px-8">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-8 w-44 rounded-md bg-muted" />
        <div className="mt-6 h-10 rounded-md bg-muted/70" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-14 rounded-md bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
