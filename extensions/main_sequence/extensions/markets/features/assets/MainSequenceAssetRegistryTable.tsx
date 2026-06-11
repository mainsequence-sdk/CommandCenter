import { ArrowUpRight } from "lucide-react";

import type { AssetListRow } from "../../../../common/api";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

function formatAssetValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

function formatAssetType(asset: AssetListRow) {
  return formatAssetValue(asset.asset_type ?? asset.security_type);
}

export function MainSequenceAssetRegistryTable({
  assets,
  onOpenAsset,
}: {
  assets: AssetListRow[];
  onOpenAsset: (asset: AssetListRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Asset</th>
            <th className="px-4 pb-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>
                <button
                  type="button"
                  className="block w-full min-w-0 text-left"
                  onClick={() => onOpenAsset(asset)}
                >
                  <div className="min-w-0">
                    <div className="group inline-flex max-w-full items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                      <span className="truncate">
                        {formatAssetValue(
                          asset.name,
                          asset.unique_identifier || asset.figi || asset.uid,
                        )}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {[
                        asset.uid ? `UID ${asset.uid}` : null,
                        asset.unique_identifier ? `Identifier ${asset.unique_identifier}` : null,
                        asset.figi ? `FIGI ${asset.figi}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </button>
              </td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                {formatAssetType(asset)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
