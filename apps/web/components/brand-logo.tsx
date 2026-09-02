import { cn } from "@/lib/utils";
import Image from "next/image";

type BrandLogoProps = {
  readonly className?: string;
  readonly size?: number;
  readonly priority?: boolean;
};

/**
 * Invoicey product mark for app chrome.
 */
export function BrandLogo({
  className,
  size = 32,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        alt="Invoicey"
        className="size-full object-contain"
        height={size}
        priority={priority}
        src="/brand/invoicey-mark.svg"
        width={size}
      />
    </span>
  );
}
