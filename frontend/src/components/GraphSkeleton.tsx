export function GraphSkeleton() {
  const left = [0, 1, 2];
  const right = [0, 1, 2, 3, 4];
  return (
    <div className="absolute inset-0 flex items-start justify-center gap-64 pt-20">
      <div className="flex flex-col gap-12">
        {left.map((i) => (
          <div
            key={i}
            className="h-[88px] w-[220px] animate-pulse rounded-lg border border-[#2a2a3a] bg-[#12121a]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex gap-3 p-3">
              <div className="h-5 w-5 shrink-0 rounded bg-[#2a2a3a]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#2a2a3a]" />
                <div className="flex gap-2">
                  <div className="h-5 w-14 rounded bg-[#2a2a3a]" />
                  <div className="h-5 w-16 rounded bg-[#2a2a3a]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-12">
        {right.map((i) => (
          <div
            key={i}
            className="h-[88px] w-[220px] animate-pulse rounded-lg border border-[#2a2a3a] bg-[#12121a]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex gap-3 p-3">
              <div className="h-5 w-5 shrink-0 rounded bg-[#2a2a3a]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#2a2a3a]" />
                <div className="flex gap-2">
                  <div className="h-5 w-14 rounded bg-[#2a2a3a]" />
                  <div className="h-5 w-16 rounded bg-[#2a2a3a]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
