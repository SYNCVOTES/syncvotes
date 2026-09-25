import { error } from '@sveltejs/kit';
import { request } from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP, BlockList } from 'node:net';
import type { RequestHandler } from './$types';

/**
 * Pictures users link to — a DAO's cover, a face, an image in a description — fetched here and
 * served from this origin, so the server they live on sees this app ask, never who is looking.
 * Only https, only raster images, only public addresses (checked as the connection is made, so
 * a name cannot resolve somewhere private in between), no redirects, five megabytes at most.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/;

// Nowhere a picture may live: loopback, private, link-local, carrier-grade NAT, multicast and
// the rest of what is not the public internet.
const blocked = new BlockList();
for (const [net, bits] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['224.0.0.0', 3]
] as const)
	blocked.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
	['::', 127],
	['::ffff:0:0', 96],
	['64:ff9b::', 96],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8]
] as const)
	blocked.addSubnet(net, bits, 'ipv6');
const isPublic = (address: string) =>
	!blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');

/** Name resolution that refuses to connect anywhere private. */
function publicLookup(
	hostname: string,
	options: object,
	callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void
) {
	dnsLookup(hostname, { all: true }, (err, addresses) => {
		if (err) return callback(err, '');
		const ok = addresses.filter((a) => isPublic(a.address));
		if (ok.length === 0 || ok.length !== addresses.length) {
			return callback(new Error('Not a public address'), '');
		}
		if ((options as { all?: boolean }).all) return callback(null, ok);
		callback(null, ok[0].address, ok[0].family);
	});
}

type Picture = { type: string; body: Buffer; at: number };
/** Recently fetched pictures, oldest first; about a hundred megabytes at most. */
const cache = new Map<string, Picture>();
let cached = 0;
const TTL = 3600_000;
const remember = (url: string, picture: Picture) => {
	cache.set(url, picture);
	cached += picture.body.length;
	for (const [key, old] of cache) {
		if (cached <= 100 * 1024 * 1024) break;
		cache.delete(key);
		cached -= old.body.length;
	}
};

function fetchPicture(url: URL): Promise<Picture> {
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{ lookup: publicLookup, timeout: 10_000, headers: { accept: 'image/*' } },
			(res) => {
				const type = String(res.headers['content-type'] ?? '')
					.split(';')[0]
					.trim()
					.toLowerCase();
				if (res.statusCode !== 200 || !TYPES.test(type)) {
					res.resume();
					return reject(new Error(`Not a picture (${res.statusCode} ${type})`));
				}
				const chunks: Buffer[] = [];
				let size = 0;
				res.on('data', (chunk: Buffer) => {
					size += chunk.length;
					if (size > MAX_BYTES) {
						req.destroy(new Error('Too large'));
						return;
					}
					chunks.push(chunk);
				});
				res.on('end', () => resolve({ type, body: Buffer.concat(chunks), at: Date.now() }));
				res.on('error', reject);
			}
		);
		req.on('timeout', () => req.destroy(new Error('Timed out')));
		req.on('error', reject);
		req.end();
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const target = url.searchParams.get('u') ?? '';
	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		error(400, 'Not a link');
	}
	if (parsed.protocol !== 'https:' || target.length > 2000 || parsed.username || parsed.password) {
		error(400, 'Only https links');
	}
	// An address written as such is never looked up, so it is checked here.
	const literal = parsed.hostname.replace(/^\[|\]$/g, '');
	if (isIP(literal) && !isPublic(literal)) error(400, 'Not a public address');
	let picture = cache.get(parsed.href);
	if (!picture || Date.now() - picture.at > TTL) {
		try {
			picture = await fetchPicture(parsed);
		} catch {
			error(404, 'No picture there');
		}
		remember(parsed.href, picture);
	}
	return new Response(new Uint8Array(picture.body), {
		headers: {
			'content-type': picture.type,
			'cache-control': 'public, max-age=3600',
			'x-content-type-options': 'nosniff',
			// Opened on its own, it is a picture and nothing else.
			'content-security-policy': "default-src 'none'; sandbox",
			'cross-origin-resource-policy': 'same-origin'
		}
	});
};
