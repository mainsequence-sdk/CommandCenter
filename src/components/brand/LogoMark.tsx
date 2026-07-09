import { cn } from "@/lib/utils";
import { StarMark } from "@/components/brand/StarMark";

export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      aria-hidden="true"
    >
      <StarMark size={size} dataUrl="/data/hr-main-sequence.json" />
    </div>
  );
}
