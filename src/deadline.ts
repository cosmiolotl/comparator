export async function withDeadline<Result>(
  timeoutMs: number,
  label: string,
  operation: (signal: AbortSignal) => Promise<Result>,
  parent?: AbortSignal,
): Promise<Result> {
  const controller = new AbortController();
  const abortFromParent = (): void => controller.abort(parent?.reason);
  parent?.addEventListener('abort', abortFromParent, { once: true });
  if (parent?.aborted) abortFromParent();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${timeoutMs} ms`));
  }, timeoutMs);
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  try {
    return await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abortFromParent);
    controller.signal.removeEventListener('abort', onAbort);
    controller.abort(new Error(`${label} finished`));
  }
}
