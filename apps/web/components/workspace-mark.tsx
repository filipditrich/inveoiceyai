import { cn } from "@/lib/utils";

export function WorkspaceMark({
  name,
  logo,
  className,
}: {
  name: string;
  logo: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={cn(
          "bg-background size-8 shrink-0 rounded-md object-cover",
          className,
        )}
        src={logo}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-brand/15 text-brand flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold uppercase",
        className,
      )}
    >
      {name.slice(0, 2)}
    </div>
  );
}
