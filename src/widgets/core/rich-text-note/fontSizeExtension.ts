import { Extension } from "@tiptap/core";

export const richTextFontSizeOptions = [
  { value: "default", label: "Body" },
  { value: "sm", label: "Small" },
  { value: "base", label: "Base" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL" },
  { value: "4xl", label: "4XL" },
] as const;

export type RichTextFontSizeOption = (typeof richTextFontSizeOptions)[number];
export type RichTextFontSizeValue = Exclude<RichTextFontSizeOption["value"], "default">;

const fontSizeCssByToken: Record<RichTextFontSizeValue, string> = {
  sm: "var(--font-size-body-sm)",
  base: "var(--font-size-body)",
  lg: "1.125rem",
  xl: "1.375rem",
  "2xl": "1.75rem",
  "3xl": "2.25rem",
  "4xl": "3rem",
};

export function isRichTextFontSizeValue(value: unknown): value is RichTextFontSizeValue {
  return typeof value === "string" && value in fontSizeCssByToken;
}

export function resolveRichTextFontSizeCss(
  value: RichTextFontSizeValue | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return fontSizeCssByToken[value] ?? null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const fontSize = element.getAttribute("data-font-size");

              return isRichTextFontSizeValue(fontSize) ? fontSize : null;
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const fontSize = isRichTextFontSizeValue(attributes.fontSize)
                ? attributes.fontSize
                : null;
              const cssValue = resolveRichTextFontSizeCss(fontSize);

              if (!fontSize || !cssValue) {
                return {};
              }

              return {
                "data-font-size": fontSize,
                style: `font-size: ${cssValue}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
