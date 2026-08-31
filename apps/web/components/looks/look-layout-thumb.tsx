import type { LookBand, LookDocument } from "@invoicey/invoice-core/looks";

import { cn } from "@/lib/utils";

function slotShade(block: string, accent: string): string {
  if (block === "title" || block === "lines" || block === "totals") {
    return accent;
  }
  if (block === "footer") return `${accent}33`;
  return `${accent}66`;
}

function SlotBars({
  accent,
  slots,
}: {
  accent: string;
  slots: { block: string }[];
}) {
  return (
    <div className="flex min-h-1 flex-col justify-center gap-px">
      {slots.map((slot, index) => (
        <div
          className="h-1 rounded-[1px]"
          key={`${slot.block}-${String(index)}`}
          style={{ background: slotShade(slot.block, accent) }}
        />
      ))}
    </div>
  );
}

function BandThumb({ accent, band }: { accent: string; band: LookBand }) {
  if (band.type === "stack" || band.type === "footer") {
    return <SlotBars accent={accent} slots={[...band.slots]} />;
  }
  const columns =
    band.split === "1/2"
      ? "1fr 2fr"
      : band.split === "2/1"
        ? "2fr 1fr"
        : "1fr 1fr";
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: columns }}>
      <SlotBars accent={accent} slots={band.start} />
      <SlotBars accent={accent} slots={band.end} />
    </div>
  );
}

/** Miniature A4 so Classic, Minimal, and workspace looks are distinguishable. */
export function LookLayoutThumb({
  accent = "#0a0a0a",
  className,
  layout,
  paper = "#ffffff",
}: {
  accent?: string;
  className?: string;
  layout: LookDocument["layout"];
  paper?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-[210/297] w-16 shrink-0 flex-col justify-between gap-0.5 rounded-sm border p-1",
        className,
      )}
      style={{ background: paper }}
    >
      {layout.bands.map((band, index) => (
        <BandThumb
          accent={accent}
          band={band}
          key={`thumb-band-${String(index)}`}
        />
      ))}
    </div>
  );
}
