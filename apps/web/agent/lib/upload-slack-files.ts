import { connectSlackCredentials } from "@vercel/connect/eve";
import { callSlackApi } from "eve/channels/slack";

import { SLACK_CONNECT_UID } from "./slack-connect";

export interface SlackFilePayload {
  filename: string;
  /** base64 bytes */
  contentBase64: string;
  title?: string;
}

/** Upload files into a Slack thread (getUploadURLExternal → POST bytes → complete). */
export async function uploadFilesToSlackThread(options: {
  channelId: string;
  threadTs: string;
  files: SlackFilePayload[];
  initialComment?: string;
}): Promise<{ ok: true; fileIds: string[] } | { ok: false; error: string }> {
  if (options.files.length === 0) {
    return { ok: false, error: "no files to upload" };
  }

  const { botToken } = connectSlackCredentials(SLACK_CONNECT_UID);
  const fileIds: string[] = [];

  try {
    for (const file of options.files) {
      const bytes = Buffer.from(file.contentBase64, "base64");
      const urlRes = await callSlackApi({
        botToken,
        operation: "files.getUploadURLExternal",
        body: {
          filename: file.filename,
          length: bytes.byteLength,
        },
      });
      if (urlRes.ok !== true) {
        return {
          ok: false,
          error: `files.getUploadURLExternal: ${String(urlRes.error ?? "unknown")}`,
        };
      }
      const uploadUrl =
        typeof urlRes.upload_url === "string" ? urlRes.upload_url : "";
      const fileId = typeof urlRes.file_id === "string" ? urlRes.file_id : "";
      if (!uploadUrl || !fileId) {
        return { ok: false, error: "missing upload_url or file_id" };
      }

      const token =
        typeof botToken === "function" ? await botToken() : botToken;
      const put = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/octet-stream",
        },
        body: bytes,
      });
      if (!put.ok) {
        return { ok: false, error: `file byte upload HTTP ${put.status}` };
      }
      fileIds.push(fileId);
    }

    const complete = await callSlackApi({
      botToken,
      operation: "files.completeUploadExternal",
      body: {
        channel_id: options.channelId,
        thread_ts: options.threadTs,
        initial_comment: options.initialComment,
        files: options.files.map((f, i) => ({
          id: fileIds[i],
          title: f.title ?? f.filename,
        })),
      },
    });
    if (complete.ok !== true) {
      return {
        ok: false,
        error: `files.completeUploadExternal: ${String(complete.error ?? "unknown")}`,
      };
    }
    return { ok: true, fileIds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Upload rendered PDF + ISDOC into the current Slack thread. */
export async function uploadInvoiceArtifacts(options: {
  channelId: string;
  threadTs: string;
  filenamePdf: string;
  filenameIsdoc: string;
  pdfBase64: string;
  isdocXml: string;
  initialComment?: string;
}) {
  return uploadFilesToSlackThread({
    channelId: options.channelId,
    threadTs: options.threadTs,
    initialComment: options.initialComment,
    files: [
      {
        filename: options.filenamePdf,
        contentBase64: options.pdfBase64,
        title: options.filenamePdf,
      },
      {
        filename: options.filenameIsdoc,
        contentBase64: Buffer.from(options.isdocXml, "utf8").toString("base64"),
        title: options.filenameIsdoc,
      },
    ],
  });
}
