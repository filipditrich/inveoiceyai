import { Button } from "@/components/ui/button";
import Link from "next/link";

export type TableFilterOption = {
  value: string;
  label: string;
};

export function TableFilterBar({
  options,
  value,
  hrefFor,
}: {
  options: readonly TableFilterOption[];
  value: string;
  hrefFor: (next: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {options.map((option) => (
        <Button
          key={option.value}
          render={<Link href={hrefFor(option.value)} prefetch />}
          size="sm"
          variant={option.value === value ? "default" : "outline"}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
