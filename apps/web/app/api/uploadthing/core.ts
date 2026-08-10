import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

/** Open-demo middleware — no auth until Plan 14. */
async function demoMiddleware() {
	return { workspace: "default" as const };
}

export const ourFileRouter = {
	/** Logo: PNG / JPEG / SVG (uploads.md). */
	issuerLogo: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/svg+xml": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(demoMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
	/** Stamp: PNG / JPEG only. */
	issuerStamp: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(demoMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
	/** Signature: PNG / JPEG only. */
	issuerSignature: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(demoMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
