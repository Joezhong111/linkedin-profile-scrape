import React from 'react';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-slate-700 ${className}`}
      aria-hidden="true"
    />
  );
}

interface TableRowSkeletonProps {
  count?: number;
}

export function TableRowSkeleton({ count = 3 }: TableRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-t border-gray-100 dark:border-slate-700">
          <td className="p-3">
            <Skeleton className="h-5 w-5 rounded" />
          </td>
          <td className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </td>
          <td className="p-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="p-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="p-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="p-3">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="p-3">
            <Skeleton className="h-4 w-28" />
          </td>
          <td className="p-3">
            <Skeleton className="h-8 w-20 rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
              <div className="flex items-center gap-3 mt-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
