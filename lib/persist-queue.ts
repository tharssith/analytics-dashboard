type Flusher = () => Promise<void>;

const flushers = new Set<Flusher>();

export function registerFlusher(flush: Flusher): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

export async function flushAllPersists(): Promise<void> {
  await Promise.allSettled([...flushers].map((flush) => flush()));
}
