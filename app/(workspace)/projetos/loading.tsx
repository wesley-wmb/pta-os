export default function ProjectsLoading() {
  return (
    <div className="px-5 py-6 sm:px-8" aria-label="Carregando projetos">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-12 animate-pulse rounded-xl bg-muted" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-xl bg-muted/70"
          />
        ))}
      </div>
    </div>
  );
}
