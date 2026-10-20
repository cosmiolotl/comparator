import type { ServerAdapter } from '../src/adapter.js';

export default {
  name: 'managed-vanilla',
  async restart(mode, signal) {
    const url = process.env.COMPARATOR_LIFECYCLE_URL;
    const token = process.env.COMPARATOR_LIFECYCLE_TOKEN;
    if (!url || !token) throw new Error('The managed adapter requires the vanilla launcher lifecycle endpoint');
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-comparator-mode': mode },
      signal,
    });
    if (!response.ok) throw new Error(`Managed restart failed (${response.status}): ${await response.text()}`);
  },
} satisfies ServerAdapter;
