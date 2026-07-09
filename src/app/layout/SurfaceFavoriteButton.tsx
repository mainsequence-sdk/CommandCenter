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
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/68 transition-colors hover:bg-muted/45 hover:text-primary dark:text-muted-foreground",
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
      <Star className={cn("h-3 w-3", favorite && "fill-current")} />
    </button>
  );
}
