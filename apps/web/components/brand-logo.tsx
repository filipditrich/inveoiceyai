import { cn } from "@/lib/utils";
import Image from "next/image";

type BrandLogoProps = {
	readonly className?: string;
	readonly size?: number;
	readonly priority?: boolean;
};

/**
 * Invoicey robot mark for app chrome.
 */
export function BrandLogo({
	className,
	size = 32,
	priority = false,
}: BrandLogoProps) {
	return (
		<span
			className={cn(
				"relative inline-flex shrink-0 overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<Image
				alt="Invoicey"
				className="object-cover"
				height={size}
				priority={priority}
				src="/brand/invoicey-logo.png"
				width={size}
			/>
		</span>
	);
}
