import { cn } from "@/lib/utils";
import Image from "next/image";

type BrandLogoProps = {
  readonly className?: string;
  readonly size?: number;
  readonly priority?: boolean;
  readonly tone?: "adaptive" | "on-dark" | "on-light";
  readonly variant?: "mark" | "wordmark";
};

/**
 * Shared Invoicey identity. Compact controls use the monogram; branded chrome
 * uses the wordmark with its orange dot over the second `i`.
 */
export function BrandLogo({
  className,
  size = 32,
  priority = false,
  tone = "adaptive",
  variant = "mark",
}: BrandLogoProps) {
  const width = variant === "wordmark" ? Math.round(size * 3.75) : size;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width, height: size }}
    >
      {variant === "mark" ? (
        <Image
          alt="Invoicey"
          className="size-full object-contain"
          height={size}
          priority={priority}
          src="/brand/invoicey-mark.svg"
          width={width}
        />
      ) : tone === "on-dark" ? (
        <Image
          alt="Invoicey"
          className="size-full object-contain"
          height={size}
          priority={priority}
          src="/brand/invoicey-lockup.svg"
          width={width}
        />
      ) : tone === "on-light" ? (
        <Image
          alt="Invoicey"
          className="size-full object-contain"
          height={size}
          priority={priority}
          src="/brand/invoicey-lockup-on-light.svg"
          width={width}
        />
      ) : (
        <>
          <Image
            alt="Invoicey"
            className="size-full object-contain dark:hidden"
            height={size}
            priority={priority}
            src="/brand/invoicey-lockup-on-light.svg"
            width={width}
          />
          <Image
            alt=""
            aria-hidden="true"
            className="hidden size-full object-contain dark:block"
            height={size}
            priority={priority}
            src="/brand/invoicey-lockup.svg"
            width={width}
          />
        </>
      )}
    </span>
  );
}
