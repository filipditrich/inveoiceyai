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
  /** Logo: PNG / JPEG; PDF rendering validates the same formats. */
  issuerLogo: f({
    "image/png": { maxFileSize: "1MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
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
  /** Workspace chrome logo (switcher / settings). Not used on invoice PDFs. */
  workspaceLogo: f({
    "image/png": { maxFileSize: "1MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "1MB", maxFileCount: 1 },
  })
    .middleware(authedMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),
  /** Bulk PDF import — stored as immutable invoice artifacts. */
  importedInvoicePdf: f({
    "application/pdf": { maxFileSize: "16MB", maxFileCount: 40 },
  })
    .middleware(authedMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, name: file.name };
    }),
  importedInvoiceIsdoc: f({
    "application/xml": { maxFileSize: "2MB", maxFileCount: 40 },
    "text/xml": { maxFileSize: "2MB", maxFileCount: 40 },
  })
    .middleware(authedMiddleware)
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
