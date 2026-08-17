export type UploadedFile = {
  url: string;
  name: string;
  type: string;
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function uploadedFileUrl(file: {
  name: string;
  type: string;
  ufsUrl?: string;
  url?: string;
  serverData?: unknown;
}): string | undefined {
  if (file.serverData && typeof file.serverData === "object") {
    const url = (file.serverData as { url?: unknown }).url;
    if (typeof url === "string" && url.length > 0) {
      return url;
    }
  }
  if (typeof file.ufsUrl === "string" && file.ufsUrl.length > 0) {
    return file.ufsUrl;
  }
  if (typeof file.url === "string" && file.url.length > 0) {
    return file.url;
  }
  return undefined;
}

export function mapUploadedFiles(
  files: Array<{
    name: string;
    type: string;
    ufsUrl?: string;
    url?: string;
    serverData?: unknown;
  }>,
): UploadedFile[] {
  return files.flatMap((file) => {
    const url = uploadedFileUrl(file);
    if (!url) {
      return [];
    }
    return [{ url, name: file.name, type: file.type }];
  });
}
