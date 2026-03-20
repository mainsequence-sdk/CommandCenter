import { cn } from "@/lib/utils";
import { useCommandCenterConfig } from "@/config/CommandCenterConfigProvider";
import { useTheme } from "@/themes/ThemeProvider";

interface BrandWordmarkProps {
  className?: string;
  imageClassName?: string;
}

export function BrandWordmark({
  className,
  imageClassName,
}: BrandWordmarkProps) {
  const { branding } = useCommandCenterConfig();
  const { activeTheme } = useTheme();
  const logoSrc =
    activeTheme.mode === "dark"
      ? branding.logoDarkmodeSrc
      : branding.logoLightmodeSrc;

  return (
    <div className={cn("inline-flex items-center", className)}>
      <img
        src={logoSrc}
        alt={branding.logoAlt}
        className={cn("block h-4 w-auto object-contain", imageClassName)}
      />
    </div>
  );
}
