import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/__docusaurus/debug',
    component: ComponentCreator('/docs/__docusaurus/debug', 'e58'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/config',
    component: ComponentCreator('/docs/__docusaurus/debug/config', '2ce'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/content',
    component: ComponentCreator('/docs/__docusaurus/debug/content', '11b'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/globalData',
    component: ComponentCreator('/docs/__docusaurus/debug/globalData', 'f13'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/metadata',
    component: ComponentCreator('/docs/__docusaurus/debug/metadata', 'bff'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/registry',
    component: ComponentCreator('/docs/__docusaurus/debug/registry', '830'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/routes',
    component: ComponentCreator('/docs/__docusaurus/debug/routes', '13e'),
    exact: true
  },
  {
    path: '/docs/',
    component: ComponentCreator('/docs/', 'a9a'),
    routes: [
      {
        path: '/docs/',
        component: ComponentCreator('/docs/', '3c2'),
        routes: [
          {
            path: '/docs/',
            component: ComponentCreator('/docs/', 'c57'),
            routes: [
              {
                path: '/docs/access-rbac-app',
                component: ComponentCreator('/docs/access-rbac-app', 'f1f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr-shared-workspace-state',
                component: ComponentCreator('/docs/adr-shared-workspace-state', 'edd'),
                exact: true
              },
              {
                path: '/docs/apps-and-surfaces',
                component: ComponentCreator('/docs/apps-and-surfaces', '7ef'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/architecture',
                component: ComponentCreator('/docs/architecture', '0e9'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/backend-and-auth',
                component: ComponentCreator('/docs/backend-and-auth', '55f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/configuration',
                component: ComponentCreator('/docs/configuration', '193'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/core-widgets',
                component: ComponentCreator('/docs/core-widgets', 'c30'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/dashboard-layouts',
                component: ComponentCreator('/docs/dashboard-layouts', '6a5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/deployment',
                component: ComponentCreator('/docs/deployment', 'fe6'),
                exact: true
              },
              {
                path: '/docs/extensions',
                component: ComponentCreator('/docs/extensions', 'b84'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/internationalization',
                component: ComponentCreator('/docs/internationalization', '246'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/notifications',
                component: ComponentCreator('/docs/notifications', '38f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/rbac-assignment-matrix',
                component: ComponentCreator('/docs/rbac-assignment-matrix', 'bb0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/theming',
                component: ComponentCreator('/docs/theming', '4c1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspace-backend-model',
                component: ComponentCreator('/docs/workspace-backend-model', 'f87'),
                exact: true
              },
              {
                path: '/docs/workspaces',
                component: ComponentCreator('/docs/workspaces', 'aa3'),
                exact: true
              },
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', '597'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
