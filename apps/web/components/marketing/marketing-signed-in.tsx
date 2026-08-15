import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SessionUser } from "@/lib/auth/session";

export function sessionDisplayName(user: SessionUser): string {
  const name = user.name.trim();
  return name.length > 0 ? name : user.email;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function MarketingSignedInChip({
  caption,
  className,
  user,
}: Readonly<{
  caption?: string;
  className?: string;
  user: SessionUser;
}>) {
  const name = sessionDisplayName(user);
  return (
    <span className={className ?? "inline-flex min-w-0 items-center gap-2"}>
      <Avatar size="sm">
        {user.image ? <AvatarImage src={user.image} alt={name} /> : null}
        <AvatarFallback className="bg-primary text-primary-foreground text-[0.65rem] font-semibold">
          {initialsFromName(name)}
        </AvatarFallback>
      </Avatar>
      {caption ? (
        <span className="min-w-0">
          <span className="text-muted-foreground block truncate text-[0.65rem] leading-none">
            {caption}
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium leading-tight">
            {name}
          </span>
        </span>
      ) : (
        <span className="truncate text-sm font-medium">{name}</span>
      )}
    </span>
  );
}
