export default function SearchLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1040px] px-5 py-9 sm:px-8 sm:py-12"
      aria-busy="true"
      aria-label="Carregando busca"
    >
      <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-4 h-9 w-full max-w-lg animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-8 h-11 w-full max-w-2xl animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-10 space-y-3 border-t pt-6">
        <div className="h-14 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded bg-muted/70 motion-reduce:animate-none" />
      </div>
    </div>
  );
}
