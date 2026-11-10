/**
 * Provider adapter utilities shared by the Apify and treg adapters.
 */

/** Waits `ms` without blocking; a non-positive delay resolves immediately. */
export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}
