/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: "category",
      label: "Introduction",
      collapsed: false,
      items: ["README"],
    },
    {
      type: "category",
      label: "Platform Foundation",
      collapsed: false,
      items: ["architecture", "configuration", "backend-and-auth", "theming", "internationalization"],
    },
    {
      type: "category",
      label: "Experience Model",
      collapsed: false,
      items: ["apps-and-surfaces", "core-widgets", "dashboard-layouts", "extensions"],
    },
    {
      type: "category",
      label: "Platform Capabilities",
      collapsed: false,
      items: ["notifications", "rbac-assignment-matrix"],
    },
  ],
};

module.exports = sidebars;
