import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function getConnectionInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DS";
}

export function ConnectionTypeIcon({
  title,
  iconUrl,
  imageAlt,
  backgroundColor,
  className,
}: {
  title: string;
  iconUrl?: string;
  imageAlt?: string;
  backgroundColor?: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [iconUrl]);

  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-muted text-sm font-semibold text-foreground",
        className,
      )}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {iconUrl && !imageFailed ? (
        <img
          src={iconUrl}
          alt={imageAlt ?? `${title} logo`}
          className="h-4/5 w-4/5 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getConnectionInitials(title)
      )}
    </span>
  );
}
