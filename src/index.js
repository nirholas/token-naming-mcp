#!/usr/bin/env node
// @three-ws/naming-mcp — MCP server entry point.
//
// Gives any AI assistant the three.ws naming / identity layer over stdio:
//   • sns_resolve          — resolve a .sol name → owner wallet
//   • sns_reverse          — reverse-lookup a wallet → primary .sol name
//   • threews_availability — is <label>.threews.sol free to claim as an agent identity?
//
// A thin wrapper over the PUBLIC three.ws API (/api/sns, /api/threews/subdomain).
// No keys, no signer, no payment — point THREE_WS_BASE at a deployment and go.
//
// Run standalone:
//   node packages/naming-mcp/src/index.js
//
// Or wire into Claude Code / Cursor — see README.md.

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { def as snsResolve } from './tools/sns-resolve.js';
import { def as snsReverse } from './tools/sns-reverse.js';
import { def as threewsAvailability } from './tools/threews-availability.js';

// Single source of truth for the advertised server version — package.json.
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../package.json');

export const TOOLS = [snsResolve, snsReverse, threewsAvailability];

/**
 * Construct a fully-registered McpServer without connecting a transport.
 * Registration is env-free, so this is safe to import from tests.
 * @returns {McpServer}
 */
export function buildServer() {
	const server = new McpServer(
		{ name: 'naming-mcp', title: 'three.ws Naming', version: PKG_VERSION },
		{
			capabilities: { tools: {} },
			instructions:
				'three.ws Naming MCP — the on-chain identity layer for AI agents. sns_resolve resolves a Solana ' +
				'.sol name to the wallet that owns it; sns_reverse goes the other way, mapping a wallet to its ' +
				'primary .sol name. threews_availability checks whether "<label>.threews.sol" is free to claim as ' +
				'an agent identity — three.ws subdomains showcase an agent profile at /u/<label>, so claiming one ' +
				'gives your agent a name. All data comes live from the public three.ws /api/sns and ' +
				'/api/threews/subdomain endpoints, backed by Solana / Bonfida SNS (mainnet). No API key, signer, ' +
				'or payment required. Minting a *.threews.sol subdomain is an authenticated write on the HTTP API; ' +
				'this server exposes resolution and availability.',
		},
	);

	for (const tool of TOOLS) {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: tool.annotations,
			},
			async (args, extra) => {
				try {
					const result = await tool.handler(args, extra);
					const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
					return { content: [{ type: 'text', text }] };
				} catch (err) {
					const payload = {
						ok: false,
						error: err?.code || 'unhandled',
						message: err?.message || String(err),
						...(err?.status ? { status: err.status } : {}),
					};
					return {
						content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
						isError: true,
					};
				}
			},
		);
	}

	return server;
}

async function main() {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`[naming-mcp@${PKG_VERSION}] connected over stdio with ${TOOLS.length} tools`);
}

// Connect stdio ONLY when this file is the process entry point. Importing the
// module (tests, embedding) must not grab the transport. realpath both sides:
// npm bin shims are symlinks, so argv[1] may differ from import.meta.url.
function isProcessEntryPoint() {
	if (!process.argv[1]) return false;
	try {
		return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
	} catch {
		return false;
	}
}

if (isProcessEntryPoint()) {
	main().catch((err) => {
		console.error('[naming-mcp] fatal:', err);
		process.exit(1);
	});
}
