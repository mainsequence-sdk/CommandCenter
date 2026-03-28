// @ts-check

const githubRepositoryOwner = process.env.GITHUB_REPOSITORY_OWNER || "mainsequence-sdk";
const githubRepositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] || "CommandCenter";
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const docsSiteUrl = process.env.DOCS_SITE_URL || `https://${githubRepositoryOwner}.github.io`;
const docsBaseUrl =
  process.env.DOCS_BASE_URL || (isGitHubPagesBuild ? `/${githubRepositoryName}/` : "/docs/");
const appUrl = process.env.COMMAND_CENTER_APP_URL || "http://localhost:5173/app";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Main Sequence Command Center",
  tagline: "Launch branded command surfaces faster.",
  favicon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230b1017'/%3E%3Cpath d='M8 23V9h3.2l4.8 7.8L20.8 9H24v14h-3V14.7l-4.1 6.7h-1.8L11 14.7V23H8Z' fill='%23f1e7c9'/%3E%3C/svg%3E",
  url: docsSiteUrl,
  baseUrl: docsBaseUrl,
  organizationName: githubRepositoryOwner,
  projectName: githubRepositoryName,
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: "../docs",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl:
            "https://github.com/main-sequence/command-center/tree/main/",
        },
        blog: false,
        pages: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 630'%3E%3Crect width='1200' height='630' fill='%230b1017'/%3E%3Cpath d='M190 455V175h70l105 156 105-156h70v280h-65V289l-90 133h-40l-90-133v166h-65Z' fill='%23f1e7c9'/%3E%3C/svg%3E",
      navbar: {
        title: "Command Center Docs",
        items: [
          {
            type: "docSidebar",
            sidebarId: "docsSidebar",
            position: "left",
            label: "Documentation",
          },
          {
            href: appUrl,
            label: "Open App",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Architecture",
                to: "/architecture",
              },
              {
                label: "Notifications",
                to: "/notifications",
              },
              {
                label: "RBAC Assignment Matrix",
                to: "/rbac-assignment-matrix",
              },
            ],
          },
          {
            title: "Platform",
            items: [
              {
                label: "Command Center App",
                href: appUrl,
              },
              {
                label: "Extensions",
                to: "/extensions",
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Main Sequence`,
      },
      colorMode: {
        defaultMode: "dark",
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
    }),
};

module.exports = config;
