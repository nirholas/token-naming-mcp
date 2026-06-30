// `sns_resolve` — resolve a Solana .sol name to its owner wallet. Read-only.
//
// Wraps GET /api/sns?name=<label>[.sol].

import { z } from 'zod';

import { apiRequest } from '../lib/api.js';

export const def = {
	name: 'sns_resolve',
	title: 'Resolve a .sol name to its owner wallet',
	annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
	description:
		'Resolve a Solana Name Service (.sol) name to the base58 wallet address that owns it. Accepts a bare label, a subdomain, or the full name with or without the trailing ".sol". Returns the owner address, or resolved:false when the name is unregistered. Mainnet only. Read-only.',
	inputSchema: {
		name: z
			.string()
			.min(1)
			.describe('A .sol label to resolve, e.g. "bonfida", "nick.threews", or "bonfida.sol" (the .sol suffix is optional).'),
	},
	async handler(args) {
		const name = String(args?.name ?? '').trim();
		const data = await apiRequest('/api/sns', { query: { name } });
		const result = data?.data ?? {};
		return {
			ok: true,
			name: result.name ?? null,
			address: result.address ?? null,
			resolved: Boolean(result.resolved),
		};
	},
};
