import { Badge } from "@/components/ui/badge";
import { DISPLAY_STATUS_BADGE_CLASS } from "@/lib/invoice-status-ui";
import {
	DISPLAY_STATUS_LABELS,
	type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { cn } from "@/lib/utils";

export function InvoiceStatusBadge({
	status,
	className,
}: {
	status: InvoiceDisplayStatus;
	className?: string;
}) {
	return (
		<Badge
			className={cn(DISPLAY_STATUS_BADGE_CLASS[status], className)}
			variant="outline"
		>
			{DISPLAY_STATUS_LABELS[status]}
		</Badge>
	);
}
