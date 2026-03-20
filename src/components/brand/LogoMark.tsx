import { cn } from "@/lib/utils";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";

export function LogoMark({ className }: { className?: string }) {
  const { branding } = useCommandCenterConfig();

  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      aria-hidden="true"
    >
      {branding.logoMarkSrc ? (
        <img
          src={branding.logoMarkSrc}
          alt=""
          className="h-[72%] w-[72%] object-contain"
        />
      ) : (
        <span className="text-[10px] font-semibold tracking-[0.22em] text-foreground">
          {branding.monogram}
        </span>
      )}
    </div>
  );
}
