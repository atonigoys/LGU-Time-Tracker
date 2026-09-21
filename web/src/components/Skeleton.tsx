import type { CSSProperties } from "react";

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} style={style} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border-t-4 border-t-gray-200 bg-white p-4 shadow-sm">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-8 w-14" />
    </div>
  );
}

export function SkeletonTableRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="border-b border-gray-100 px-3 py-3">
              <Skeleton className="h-3.5 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonChart({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}
