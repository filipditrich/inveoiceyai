import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve a file under `packages/invoice-core/assets/…` across local,
 * Next `/api` traces, and Eve workflow bundles (`/.well-known/workflow`).
 */
export function resolveInvoiceCoreAsset(
	...assetRelativeParts: string[]
): string {
	const tried: string[] = [];
	const push = (candidate: string) => {
		tried.push(candidate);
		return candidate;
	};

	const candidates: string[] = [
		push(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"../../assets",
				...assetRelativeParts,
			),
		),
		push(
			path.join(
				process.cwd(),
				"packages/invoice-core/assets",
				...assetRelativeParts,
			),
		),
		push(
			path.join(
				process.cwd(),
				"../../packages/invoice-core/assets",
				...assetRelativeParts,
			),
		),
		push(path.join(process.cwd(), "assets", ...assetRelativeParts)),
	];

	/** Walk up from cwd — Eve/workflow cwd is often `/var/task`. */
	let dir = process.cwd();
	for (let i = 0; i < 6; i++) {
		candidates.push(
			push(
				path.join(dir, "packages/invoice-core/assets", ...assetRelativeParts),
			),
		);
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		`Missing invoice-core asset '${assetRelativeParts.join("/")}' — tried ${tried.join(", ")}`,
	);
}
