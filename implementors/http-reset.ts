import type { ServerAdapter } from '../src/adapter.js';

let resetUrl: URL;

export default {
  name: 'http-reset',
  async setup() {
    const endpoint = process.env.COMPARATOR_RESET_URL;
    if (!endpoint) throw new Error('Set COMPARATOR_RESET_URL to your implementor reset endpoint');
    resetUrl = new URL(endpoint);
    if (!['http:', 'https:'].includes(resetUrl.protocol)) {
      throw new Error('The reset endpoint must use HTTP or HTTPS');
    }
  },
  async beforeEach(caseId, signal) {
    const response = await fetch(resetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId }),
      signal,
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`World reset failed with HTTP ${response.status}`);
  },
} satisfies ServerAdapter;
