import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
	return (
		<div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-4 w-72" />
			<div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
			<Skeleton className="h-64 w-full" />
		</div>
	);
}
