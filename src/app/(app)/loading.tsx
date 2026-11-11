export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="animate-pulse">
      <div className="h-8 w-64 rounded bg-neutral-soft" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-neutral-soft" />
      <div className="mt-8 rounded-card border border-line bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <div className="h-4 w-12 rounded bg-neutral-soft" />
            <div className="h-4 flex-1 rounded bg-neutral-soft" />
            <div className="hidden h-6 w-28 rounded bg-neutral-soft sm:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">Загружаем данные</span>
    </div>
  );
}
