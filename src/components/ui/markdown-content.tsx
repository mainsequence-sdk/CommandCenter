import type { ComponentPropsWithoutRef } from "react";

import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(
    new Set([
      ...(defaultSchema.tagNames ?? []),
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
    ]),
  ),
  attributes: {
    ...defaultSchema.attributes,
    table: [...(defaultSchema.attributes?.table ?? [])],
    thead: [...(defaultSchema.attributes?.thead ?? [])],
    tbody: [...(defaultSchema.attributes?.tbody ?? [])],
    tr: [...(defaultSchema.attributes?.tr ?? [])],
    th: [...(defaultSchema.attributes?.th ?? []), "align", "colspan", "rowspan"],
    td: [...(defaultSchema.attributes?.td ?? []), "align", "colspan", "rowspan"],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "src",
      "alt",
      "title",
      "height",
      "width",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};

export interface MarkdownContentProps {
  content: string;
  className?: string;
  transformHref?: (href: string) => string;
  openLinksInNewTab?: boolean;
}

export function MarkdownContent({
  content,
  className,
  transformHref,
  openLinksInNewTab = true,
}: MarkdownContentProps) {
  return (
    <div
      className={cn("min-w-0 text-foreground", className)}
      style={{ fontSize: "var(--font-size-body-sm)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, markdownSanitizeSchema],
        ]}
        components={{
          h1: ({ className: headingClassName, ...props }) => (
            <h1
              className={cn(
                "mt-8 mb-4 font-semibold tracking-tight first:mt-0",
                headingClassName,
              )}
              style={{ fontSize: "var(--font-size-markdown-h1)" }}
              {...props}
            />
          ),
          h2: ({ className: headingClassName, ...props }) => (
            <h2
              className={cn(
                "mt-8 mb-3 border-b border-border/70 pb-2 font-semibold tracking-tight first:mt-0",
                headingClassName,
              )}
              style={{ fontSize: "var(--font-size-markdown-h2)" }}
              {...props}
            />
          ),
          h3: ({ className: headingClassName, ...props }) => (
            <h3
              className={cn(
                "mt-6 mb-3 font-semibold tracking-tight first:mt-0",
                headingClassName,
              )}
              style={{ fontSize: "var(--font-size-markdown-h3)" }}
              {...props}
            />
          ),
          h4: ({ className: headingClassName, ...props }) => (
            <h4
              className={cn(
                "mt-5 mb-2 font-semibold tracking-tight first:mt-0",
                headingClassName,
              )}
              style={{ fontSize: "var(--font-size-markdown-h4)" }}
              {...props}
            />
          ),
          p: ({ className: paragraphClassName, ...props }) => (
            <p
              className={cn("my-4 leading-7 text-foreground/90 first:mt-0 last:mb-0", paragraphClassName)}
              style={{
                fontSize: "var(--font-size-body)",
                lineHeight: "var(--line-height-body)",
              }}
              {...props}
            />
          ),
          a: ({ className: linkClassName, href, ...props }) => {
            const resolvedHref = href ? transformHref?.(href) ?? href : href;

            return (
              <a
                className={cn(
                  "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary/80",
                  linkClassName,
                )}
                href={resolvedHref}
                target={openLinksInNewTab ? "_blank" : undefined}
                rel={openLinksInNewTab ? "noreferrer" : undefined}
                {...props}
              />
            );
          },
          ul: ({ className: listClassName, ...props }) => (
            <ul
              className={cn("my-4 ml-6 list-disc space-y-2 marker:text-muted-foreground", listClassName)}
              {...props}
            />
          ),
          ol: ({ className: listClassName, ...props }) => (
            <ol
              className={cn("my-4 ml-6 list-decimal space-y-2 marker:text-muted-foreground", listClassName)}
              {...props}
            />
          ),
          li: ({ className: itemClassName, ...props }) => (
            <li
              className={cn("pl-1 text-foreground/90", itemClassName)}
              style={{
                fontSize: "var(--font-size-body)",
                lineHeight: "var(--line-height-body)",
              }}
              {...props}
            />
          ),
          blockquote: ({ className: blockquoteClassName, ...props }) => (
            <blockquote
              className={cn(
                "my-5 border-l-3 border-primary/45 bg-muted/35 py-2 pl-4 italic text-muted-foreground",
                blockquoteClassName,
              )}
              {...props}
            />
          ),
          hr: ({ className: ruleClassName, ...props }) => (
            <hr className={cn("my-6 border-border/70", ruleClassName)} {...props} />
          ),
          table: ({ className: tableClassName, ...props }) => (
            <div className="my-6 overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70">
              <table
                className={cn("w-full border-collapse text-left", tableClassName)}
                style={{ fontSize: "var(--table-font-size)" }}
                {...props}
              />
            </div>
          ),
          thead: ({ className: headClassName, ...props }) => (
            <thead className={cn("bg-muted/50", headClassName)} {...props} />
          ),
          th: ({ className: cellClassName, ...props }) => (
            <th
              className={cn(
                "border-b border-border/70 px-4 py-[var(--table-standard-header-padding-y)] font-semibold text-foreground",
                cellClassName,
              )}
              style={{ fontSize: "var(--table-meta-font-size)" }}
              {...props}
            />
          ),
          td: ({ className: cellClassName, ...props }) => (
            <td
              className={cn(
                "border-t border-border/60 px-4 py-[var(--table-standard-cell-padding-y)] align-top text-foreground/90",
                cellClassName,
              )}
              {...props}
            />
          ),
          img: ({ className: imageClassName, alt, ...props }) => (
            <img
              className={cn(
                "my-6 max-w-full rounded-[calc(var(--radius)-8px)] border border-border/70",
                imageClassName,
              )}
              alt={alt ?? ""}
              {...props}
            />
          ),
          code: ({
            className: codeClassName,
            children,
            ...props
          }: ComponentPropsWithoutRef<"code">) => {
            const isInline = !String(codeClassName ?? "").includes("language-");

            if (isInline) {
              return (
                <code
                  className={cn(
                    "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
                    codeClassName,
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={cn(
                  "block overflow-x-auto bg-transparent p-0 font-mono text-[13px] leading-6 text-foreground",
                  codeClassName,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ className: preClassName, ...props }) => (
            <pre
              className={cn(
                "my-6 overflow-x-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/85 p-4",
                preClassName,
              )}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
