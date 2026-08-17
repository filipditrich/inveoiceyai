import { cn } from "@/lib/utils";

export function UploadProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted h-1 w-full overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className="bg-foreground h-full transition-[width] duration-200"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
