import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export function SurfaceFavoriteButton({
  favorite,
  className,
  onToggle,
}: {
  favorite: boolean;
  className?: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/45 hover:text-primary",
        favorite && "text-primary",
        className,
      )}
      aria-pressed={favorite}
      aria-label={favorite ? t("common.removeFromFavorites") : t("common.addToFavorites")}
      title={favorite ? t("common.removeFromFavorites") : t("common.addToFavorites")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Star className={cn("h-3.5 w-3.5", favorite && "fill-current")} />
    </button>
  );
}
