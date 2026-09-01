import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  description,
  suggestion,
  error,
  className,
  children,
}: {
  label: string;
  description?: string;
  suggestion?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const generatedControlId = `invoice-field-${generatedId.replaceAll(":", "")}`;
  const childArray = Children.toArray(children);
  const controlIndex = childArray.findIndex(isValidElement);
  const control = childArray[controlIndex] as
    | ReactElement<{ id?: string; "aria-describedby"?: string }>
    | undefined;
  const controlId = control?.props.id ?? generatedControlId;
  const showDescription = Boolean(description) && !suggestion;
  const descriptionId = showDescription
    ? `${controlId}-description`
    : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const labelledChildren = childArray.map((child, index) => {
    if (index !== controlIndex || !isValidElement(child)) {
      return child;
    }
    const element = child as ReactElement<{
      id?: string;
      "aria-describedby"?: string;
    }>;
    return cloneElement(element, {
      id: controlId,
      "aria-describedby":
        element.props["aria-describedby"] ?? (describedBy || undefined),
    });
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {labelledChildren}
      {suggestion}
      {showDescription ? (
        <p className="text-xs text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function selectClassName(invalid?: boolean): string {
  return cn(
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    invalid &&
      "border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  );
}

/** Flatten RHF/Zod error messages for a top alert (max N). */
export function collectFormErrorMessages(
  errors: Record<string, unknown>,
  max = 8,
): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string) => {
    if (out.length >= max || node == null) {
      return;
    }
    if (typeof node === "object" && node !== null && "message" in node) {
      const msg = (node as { message?: unknown }).message;
      if (typeof msg === "string" && msg.length > 0) {
        out.push(prefix ? `${prefix}: ${msg}` : msg);
        return;
      }
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${prefix}[${i}]`));
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [k, v] of Object.entries(node)) {
        if (k === "ref" || k === "type") {
          continue;
        }
        const next =
          k === "message" || k === "root"
            ? prefix
            : prefix
              ? `${prefix}.${k}`
              : k;
        walk(v, next);
      }
    }
  };
  walk(errors, "");
  return out;
}
