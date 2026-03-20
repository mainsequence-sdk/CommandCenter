import dataLakeIcon from "../assets/physical-data-sources/data_lake_32x32.png";
import duckDbIcon from "../assets/physical-data-sources/duck_db.png";
import jupyterIcon from "../assets/physical-data-sources/jupyter-svgrepo-com.svg";
import podLocalLakeIcon from "../assets/physical-data-sources/pod_local_lake.png";
import timescaleIcon from "../assets/physical-data-sources/timescale.png";

const iconByClassType: Record<string, string> = {
  duck_db: duckDbIcon,
  timescale_db: timescaleIcon,
  timescale_db_remote: timescaleIcon,
  timescale_db_gcp_cloud: timescaleIcon,
};

const iconByFileName: Record<string, string> = {
  "data_lake_32x32.png": dataLakeIcon,
  "duck_db.png": duckDbIcon,
  "jupyter-svgrepo-com.svg": jupyterIcon,
  "pod_local_lake.png": podLocalLakeIcon,
  "timescale.png": timescaleIcon,
};

function extractFileName(path: string | null | undefined) {
  if (!path) {
    return "";
  }

  const sanitizedPath = path.split("?")[0]?.split("#")[0] ?? "";
  const fileName = sanitizedPath.split("/").pop() ?? "";
  return fileName.trim().toLowerCase();
}

export function resolvePhysicalDataSourceIcon({
  classType,
  sourceLogo,
}: {
  classType?: string | null;
  sourceLogo?: string | null;
}) {
  const normalizedClassType = classType?.trim().toLowerCase() ?? "";

  if (normalizedClassType && iconByClassType[normalizedClassType]) {
    return iconByClassType[normalizedClassType];
  }

  const fileName = extractFileName(sourceLogo);

  if (fileName && iconByFileName[fileName]) {
    return iconByFileName[fileName];
  }

  return sourceLogo?.trim() ? sourceLogo : null;
}
