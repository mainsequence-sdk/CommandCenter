export function shouldForceOhlcSnapshot(input: {
  chartUpdateMode: "snapshot" | "delta";
  deltaPointCount: number;
  hasStudies: boolean;
  shapeKeyChanged: boolean;
  seedPublicationChanged: boolean;
  livePublicationRole?: "seed" | "update";
  liveMode?: "snapshot" | "delta";
  liveSourceRunChanged: boolean;
  nextPointCount: number;
  previousPointCount: number;
  nextFirstPointTime: number | null;
  previousFirstPointTime: number | null;
}) {
  return (
    input.chartUpdateMode !== "delta" ||
    input.deltaPointCount === 0 ||
    input.hasStudies ||
    input.shapeKeyChanged ||
    input.seedPublicationChanged ||
    input.livePublicationRole === "seed" ||
    input.liveMode === "snapshot" ||
    input.liveSourceRunChanged ||
    input.nextPointCount < input.previousPointCount ||
    (input.previousFirstPointTime !== null &&
      input.nextFirstPointTime !== null &&
      input.nextFirstPointTime < input.previousFirstPointTime)
  );
}
