// Serialize availability reads and discard superseded queued schedules.
export function createMerchantRequestQueue() {
  let active = null;
  let latest = 0;
  return async function run(task) {
    const version = ++latest;
    while (active) {
      try { await active; } catch { /* A failed read must not block the next one. */ }
      if (version !== latest) return undefined;
    }
    const pending = Promise.resolve().then(task);
    active = pending;
    try { return await pending; }
    finally { if (active === pending) active = null; }
  };
}
