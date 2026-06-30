// Centralized env + HTTP base for the naming MCP.
//
// This server is a thin, read-only wrapper over the PUBLIC three.ws HTTP API
// (/api/sns and /api/threews/subdomain). It signs nothing and holds no secret —
// the only knobs are which deployment to talk to and how long to wait. Nothing
// about how a name resolves is baked in here; it all comes from the live
// endpoint backed by Solana / Bonfida SNS.

export function env(key, fallback) {
	const v = process.env[key];
	return v !== undefined && String(v).trim() !== '' ? String(v).trim() : fallback;
}

// Base URL of the three.ws API that serves /api/sns and /api/threews/subdomain.
// Override only when self-hosting or pointing at a preview deployment.
export const THREE_WS_BASE = env('THREE_WS_BASE', 'https://three.ws').replace(/\/+$/, '');

// Per-request timeout (ms). Resolution and availability checks hit a Solana RPC
// pool, so the default leaves room for a cold lookup; cached reads finish well
// within it.
export const HTTP_TIMEOUT_MS = (() => {
	const raw = env('THREE_WS_TIMEOUT_MS');
	if (raw === undefined) return 20000;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) {
		throw Object.assign(new Error(`THREE_WS_TIMEOUT_MS must be a positive number (got "${raw}")`), {
			code: 'bad_config',
		});
	}
	return n;
})();

// Identifies this client to the API in request logs.
export const USER_AGENT = '@three-ws/naming-mcp';
