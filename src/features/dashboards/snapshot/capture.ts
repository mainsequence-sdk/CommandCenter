import html2canvas from "html2canvas";

const UNSUPPORTED_CAPTURE_COLOR_FUNCTION_RE = /\b(?:oklab|oklch)\(/i;
const COLOR_MIX_FUNCTION_RE = /\bcolor-mix\(/i;

let captureColorCanvasContext: CanvasRenderingContext2D | null | undefined;
let captureStyleResolverElement: HTMLDivElement | null = null;

function getCaptureColorCanvasContext() {
  if (captureColorCanvasContext !== undefined) {
    return captureColorCanvasContext;
  }

  const canvas = document.createElement("canvas");
  captureColorCanvasContext = canvas.getContext("2d");
  return captureColorCanvasContext;
}

function getCaptureStyleResolverElement() {
  if (captureStyleResolverElement) {
    return captureStyleResolverElement;
  }

  const element = document.createElement("div");

  element.setAttribute("aria-hidden", "true");
  element.style.position = "fixed";
  element.style.left = "-100000px";
  element.style.top = "0";
  element.style.width = "0";
  element.style.height = "0";
  element.style.overflow = "hidden";
  element.style.pointerEvents = "none";
  element.style.opacity = "0";
  document.body.appendChild(element);
  captureStyleResolverElement = element;

  return captureStyleResolverElement;
}

function normalizeSimpleCssColor(value: string) {
  const context = getCaptureColorCanvasContext();

  if (!context) {
    return null;
  }

  try {
    context.fillStyle = "#000";
    context.fillStyle = value;
    const normalized = context.fillStyle;

    return typeof normalized === "string" && normalized.trim() ? normalized : null;
  } catch {
    return null;
  }
}

function resolveStyleValueForCapture(
  propertyName: string,
  propertyValue: string,
) {
  if (
    !propertyValue ||
    (
      !UNSUPPORTED_CAPTURE_COLOR_FUNCTION_RE.test(propertyValue) &&
      !COLOR_MIX_FUNCTION_RE.test(propertyValue)
    )
  ) {
    return propertyValue;
  }

  if (propertyName === "color" || propertyName.endsWith("color") || propertyName === "fill" || propertyName === "stroke") {
    const normalizedColor = normalizeSimpleCssColor(propertyValue);

    if (normalizedColor) {
      return normalizedColor;
    }
  }

  try {
    const resolver = getCaptureStyleResolverElement();

    resolver.style.removeProperty(propertyName);
    resolver.style.setProperty(propertyName, propertyValue);
    const resolvedValue = window.getComputedStyle(resolver).getPropertyValue(propertyName).trim();
    resolver.style.removeProperty(propertyName);

    if (
      resolvedValue &&
      !UNSUPPORTED_CAPTURE_COLOR_FUNCTION_RE.test(resolvedValue) &&
      !COLOR_MIX_FUNCTION_RE.test(resolvedValue)
    ) {
      return resolvedValue;
    }
  } catch {
    // Fall through to conservative fallbacks below.
  }

  if (propertyName === "background" || propertyName === "background-image") {
    return "none";
  }

  if (propertyName === "box-shadow" || propertyName === "text-shadow") {
    return "none";
  }

  if (propertyName === "border-image-source" || propertyName === "mask-image") {
    return "none";
  }

  if (propertyName === "color" || propertyName.endsWith("color") || propertyName === "fill" || propertyName === "stroke") {
    return propertyName === "color" ? "rgb(226, 232, 240)" : "transparent";
  }

  return propertyValue;
}

function copyComputedStyles(source: Element, target: HTMLElement | SVGElement) {
  const computed = window.getComputedStyle(source);

  for (let index = 0; index < computed.length; index += 1) {
    const propertyName = computed.item(index);

    if (!propertyName) {
      continue;
    }

    target.style.setProperty(
      propertyName,
      resolveStyleValueForCapture(
        propertyName,
        computed.getPropertyValue(propertyName),
      ),
      computed.getPropertyPriority(propertyName),
    );
  }

  target.style.setProperty("animation", "none");
  target.style.setProperty("transition", "none");
}

function cloneNodeForCapture(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? "");
  }

  if (!(node instanceof Element)) {
    return null;
  }

  if (node instanceof HTMLScriptElement) {
    return null;
  }

  if (node instanceof HTMLCanvasElement) {
    const image = document.createElement("img");

    copyComputedStyles(node, image);
    image.setAttribute("width", String(node.width));
    image.setAttribute("height", String(node.height));

    try {
      image.src = node.toDataURL("image/png");
    } catch {
      image.alt = "Canvas capture unavailable";
    }

    return image;
  }

  const clone = node.cloneNode(false);

  if (!(clone instanceof Element)) {
    return null;
  }

  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.removeAttribute("id");

  copyComputedStyles(node, clone as HTMLElement | SVGElement);

  if (node instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
    clone.value = node.value;

    if (node.checked) {
      clone.checked = true;
      clone.setAttribute("checked", "checked");
    } else {
      clone.removeAttribute("checked");
    }
  } else if (node instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
    clone.value = node.value;
    clone.textContent = node.value;
  } else if (node instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
    const selectedValues = new Set(
      Array.from(node.selectedOptions).map((option) => option.value),
    );

    Array.from(clone.options).forEach((option) => {
      option.selected = selectedValues.has(option.value);
    });
  } else if (node instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
    clone.src = node.currentSrc || node.src;
  }

  Array.from(node.childNodes).forEach((child) => {
    const clonedChild = cloneNodeForCapture(child);

    if (clonedChild) {
      clone.appendChild(clonedChild);
    }
  });

  return clone;
}

function copyScrollPositions(source: Element, target: Element) {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  const length = Math.min(sourceChildren.length, targetChildren.length);

  for (let index = 0; index < length; index += 1) {
    copyScrollPositions(sourceChildren[index], targetChildren[index]);
  }
}

function resolveCaptureScale(width: number, height: number) {
  const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  const maxSideScale = 4096 / Math.max(width, height, 1);
  const maxPixelScale = Math.sqrt(16_000_000 / Math.max(width * height, 1));

  return Math.max(0.5, Math.min(deviceScale, maxSideScale, maxPixelScale, 2));
}

async function rasterizeSvgMarkupToPng(
  svgMarkup: string,
  width: number,
  height: number,
) {
  const scale = resolveCaptureScale(width, height);
  const svgBlob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const imageLoadPromise = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to rasterize the generated SVG capture."));
    });

    image.src = svgUrl;
    await imageLoadPromise;

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is not available for snapshot capture.");
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to encode snapshot capture as PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function blobToImageDrawable(blob: Blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode capture tile."));
      image.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderCapturedElementToPng(
  sourceElement: HTMLElement,
  options?: {
    width?: number;
    height?: number;
    mutateClone?: (clone: HTMLElement) => void;
  },
) {
  const width = Math.max(
    1,
    Math.round(options?.width ?? sourceElement.getBoundingClientRect().width),
  );
  const height = Math.max(
    1,
    Math.round(options?.height ?? sourceElement.getBoundingClientRect().height),
  );
  const clonedNode = cloneNodeForCapture(sourceElement);

  if (!(clonedNode instanceof HTMLElement)) {
    throw new Error("Unable to build a styled DOM clone for snapshot capture.");
  }

  options?.mutateClone?.(clonedNode);

  const wrapper = document.createElement("div");
  const backgroundColor =
    window.getComputedStyle(sourceElement).backgroundColor || "transparent";

  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.position = "relative";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.overflow = "hidden";
  wrapper.style.background = backgroundColor;
  wrapper.appendChild(clonedNode);
  copyScrollPositions(sourceElement, clonedNode);
  const mountRoot = document.createElement("div");

  mountRoot.style.position = "fixed";
  mountRoot.style.left = "-100000px";
  mountRoot.style.top = "0";
  mountRoot.style.width = `${width}px`;
  mountRoot.style.height = `${height}px`;
  mountRoot.style.overflow = "hidden";
  mountRoot.style.pointerEvents = "none";
  mountRoot.style.zIndex = "-1";
  mountRoot.style.background = "transparent";
  mountRoot.appendChild(wrapper);
  document.body.appendChild(mountRoot);

  try {
    await waitForNextFrame();

    const canvas = await html2canvas(wrapper, {
      backgroundColor,
      width,
      height,
      scale: resolveCaptureScale(width, height),
      logging: false,
      useCORS: true,
      imageTimeout: 2000,
      removeContainer: true,
      foreignObjectRendering: false,
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to encode snapshot capture as PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    mountRoot.remove();
  }
}

export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function renderSvgMarkupToPng(
  svgMarkup: string,
  width: number,
  height: number,
) {
  return rasterizeSvgMarkupToPng(svgMarkup, width, height);
}

export async function captureElementToPng(
  element: HTMLElement,
  options?: {
    width?: number;
    height?: number;
    mutateClone?: (clone: HTMLElement) => void;
  },
) {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font availability is best-effort for capture.
    }
  }

  await waitForNextFrame();
  await waitForNextFrame();

  return renderCapturedElementToPng(element, options);
}

export async function captureScrollableViewportToPng(container: HTMLElement) {
  const previousScrollTop = container.scrollTop;

  container.scrollTop = 0;
  await waitForNextFrame();

  try {
    return await captureElementToPng(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      mutateClone: (clone) => {
        clone.style.position = "relative";
        clone.style.inset = "auto";
        clone.style.left = "0";
        clone.style.top = "0";
        clone.style.right = "auto";
        clone.style.bottom = "auto";
        clone.style.width = `${container.clientWidth}px`;
        clone.style.height = `${container.clientHeight}px`;
      },
    });
  } finally {
    container.scrollTop = previousScrollTop;
  }
}

export async function captureScrollableFullContentToPng(container: HTMLElement) {
  const previousScrollTop = container.scrollTop;
  const width = Math.max(1, container.clientWidth);
  const viewportHeight = Math.max(1, container.clientHeight);
  const fullHeight = Math.max(container.scrollHeight, viewportHeight);
  const outputScale = resolveCaptureScale(width, fullHeight);
  const stickyHeader = container.querySelector<HTMLElement>(
    "[data-workspace-snapshot-sticky-header]",
  );
  const stickyHeaderStyle = stickyHeader ? window.getComputedStyle(stickyHeader) : null;
  const stickyHeaderHeight = stickyHeader
    ? Math.max(
        0,
        Math.round(
          stickyHeader.getBoundingClientRect().height +
            Number.parseFloat(stickyHeaderStyle?.marginBottom ?? "0"),
        ),
      )
    : 0;
  const tileStep = Math.max(1, viewportHeight - stickyHeaderHeight);
  const outputCanvas = document.createElement("canvas");
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("Canvas 2D context is not available for full dashboard capture.");
  }

  outputCanvas.width = Math.max(1, Math.round(width * outputScale));
  outputCanvas.height = Math.max(1, Math.round(fullHeight * outputScale));

  container.scrollTop = 0;
  await waitForNextFrame();

  try {
    for (let tileTop = 0; tileTop < fullHeight; tileTop += tileStep) {
      container.scrollTop = tileTop;
      await waitForNextFrame();
      await waitForNextFrame();

      const tileBlob = await captureElementToPng(container, {
        width,
        height: viewportHeight,
        mutateClone: (clone) => {
          clone.style.position = "relative";
          clone.style.inset = "auto";
          clone.style.left = "0";
          clone.style.top = "0";
          clone.style.right = "auto";
          clone.style.bottom = "auto";
          clone.style.width = `${width}px`;
          clone.style.height = `${viewportHeight}px`;
        },
      });
      const tileImage = await blobToImageDrawable(tileBlob);
      const tileNaturalWidth =
        "width" in tileImage ? tileImage.width : outputCanvas.width;
      const tileNaturalHeight =
        "height" in tileImage ? tileImage.height : Math.round(viewportHeight * outputScale);
      const tileScaleY = tileNaturalHeight / viewportHeight;
      const cropTopCss = tileTop === 0 ? 0 : Math.min(stickyHeaderHeight, viewportHeight - 1);
      const cropTopPx = Math.round(cropTopCss * tileScaleY);
      const sourceHeightPx = Math.max(1, tileNaturalHeight - cropTopPx);
      const destinationY = Math.round((tileTop + cropTopCss) * outputScale);
      const destinationHeight = Math.max(
        1,
        Math.min(
          Math.round((viewportHeight - cropTopCss) * outputScale),
          outputCanvas.height - destinationY,
        ),
      );

      outputContext.drawImage(
        tileImage,
        0,
        cropTopPx,
        tileNaturalWidth,
        sourceHeightPx,
        0,
        destinationY,
        outputCanvas.width,
        destinationHeight,
      );

      if ("close" in tileImage && typeof tileImage.close === "function") {
        tileImage.close();
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to encode stitched full dashboard capture as PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
  } finally {
    container.scrollTop = previousScrollTop;
  }
}

export async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}
