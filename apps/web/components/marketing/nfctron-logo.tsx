import { cn } from "@/lib/utils";

type NfctronLogoProps = {
  readonly className?: string;
};

/**
 * NFCtron's hexagon-and-waves mark, traced from their published icon.
 * Monochrome on purpose so the backer badge inherits the surrounding text colour.
 */
export function NfctronLogo({ className }: NfctronLogoProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 256 256"
      className={cn("size-4 fill-current", className)}
      fillRule="evenodd"
    >
      <path d="M186 0 230 11 242 18 256 70 240 87 237 85 223 32 169 18Z" />
      <path d="M152 34 196 45 208 52 222 104 206 121 203 119 189 66 135 52Z" />
      <path d="M72 56 173 82 174 84 200 183 127 256 26 229 0 128ZM79 82 26 135 45 210 120 230 174 176 157 110 153 101Z" />
    </svg>
  );
}
