import type { OurFileRouter } from "@/app/api/uploadthing/core";
import {
  mapUploadedFiles,
  type UploadedFile,
} from "@/components/upload/upload-helpers";
import { useUploadThing } from "@/lib/uploadthing";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export function useTypedUploader<TEndpoint extends keyof OurFileRouter>(
  endpoint: TEndpoint,
  onComplete: (files: UploadedFile[]) => void,
) {
  const t = useTranslations("Upload");
  const [progress, setProgress] = useState(0);
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    uploadProgressGranularity: "fine",
    onUploadProgress: setProgress,
    onClientUploadComplete: (res) => {
      setProgress(0);
      onComplete(mapUploadedFiles(res));
    },
    onUploadError: (err) => {
      setProgress(0);
      toast.error(t("failed"), { description: err.message });
    },
  });

  return { startUpload, isUploading, progress };
}
