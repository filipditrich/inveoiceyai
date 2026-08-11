import { getOptionalWorkspace } from "@/lib/auth/session";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

/** Uploads are attributed to the caller's workspace; anonymous uploads are refused. */
async function authedMiddleware() {
	const context = await getOptionalWorkspace();
	if (!context) {
		throw new UploadThingError("Unauthorized");
	}
	return { userId: context.userId, workspaceId: context.workspaceId };
}

export const ourFileRouter = {
	/** Logo: PNG / JPEG / SVG (uploads.md). */
	issuerLogo: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/svg+xml": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(authedMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
	/** Stamp: PNG / JPEG only. */
	issuerStamp: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(authedMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
	/** Signature: PNG / JPEG only. */
	issuerSignature: f({
		"image/png": { maxFileSize: "1MB", maxFileCount: 1 },
		"image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
	})
		.middleware(authedMiddleware)
		.onUploadComplete(async ({ file }) => {
			return { url: file.ufsUrl };
		}),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
