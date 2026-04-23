function normalizeMarkdownText(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("<!--"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractSection(markdown: string, sectionId: string) {
  const targetHeading = normalizeHeading(sectionId);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let isCapturing = false;
  let capturedLevel = 0;
  const captured: string[] = [];

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = normalizeHeading(headingMatch[2]);

      if (isCapturing && level <= capturedLevel) {
        break;
      }

      if (heading === targetHeading) {
        isCapturing = true;
        capturedLevel = level;
        continue;
      }
    }

    if (isCapturing) {
      captured.push(line);
    }
  }

  return captured.join("\n");
}

export function resolveWidgetDescription(
  markdown: string,
  sectionId?: string,
) {
  const source = sectionId ? extractSection(markdown, sectionId) : markdown;
  const description = normalizeMarkdownText(source);

  if (!description) {
    throw new Error(
      sectionId
        ? `Widget DESCRIPTION.md section "${sectionId}" is empty or missing.`
        : "Widget DESCRIPTION.md cannot be empty.",
    );
  }

  return description;
}
