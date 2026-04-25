import rawCommandCenterConfig from "../../config/command-center.yaml?raw";

const rawEnv = import.meta.env as Record<string, string | undefined>;

export const commandCenterConfigSource = rawCommandCenterConfig.trim();

export type AssistantUiProtocol = "ui-message-stream" | "data-stream";

export interface CommandCenterAuthConfig {
  identifierLabel: string;
  identifierPlaceholder: string;
  jwt: {
    tokenUrl: string;
    refreshUrl: string;
    requestFields: {
      identifier: string;
      password: string;
      refresh: string;
    };
    responseFields: {
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    };
    claimMapping: {
      userId: string;
      name: string;
      email: string;
      team: string;
      role: string;
      organizationRole: string;
      permissions: string;
      platformPermissions: string;
      isPlatformAdmin: string;
      dateJoined: string;
      isActive: string;
      lastLogin: string;
      mfaEnabled: string;
      organizationTeams: string;
    };
    userDetails: {
      url: string;
      responseMapping: {
        userId: string;
        name: string;
        email: string;
        team: string;
        role: string;
        organizationRole: string;
        permissions: string;
        platformPermissions: string;
        isPlatformAdmin: string;
        dateJoined: string;
        isActive: string;
        lastLogin: string;
        mfaEnabled: string;
        organizationTeams: string;
      };
    };
  };
}

export interface CommandCenterConfig {
  assistantUi: {
    endpoint: string;
    protocol: AssistantUiProtocol;
  };
  app: {
    name: string;
    shortName: string;
    notificationsRefreshIntervalMs: number;
    cache: {
      appComponentOpenApiDocumentTtlMs: number;
      appComponentSafeResponseTtlMs: number;
    };
  };
  branding: {
    logoLightmodeSrc: string;
    logoDarkmodeSrc: string;
    logoMarkSrc: string;
    logoAlt: string;
    monogram: string;
  };
  preferences: {
    url: string;
    favoritesCreateUrl: string;
    favoritesReorderUrl: string;
    favoritesDeleteUrl: string;
  };
  workspaces: {
    listUrl: string;
    detailUrl: string;
    userStateListUrl: string;
  };
  savedWidgets: {
    instancesListUrl: string;
    instancesDetailUrl: string;
    groupsListUrl: string;
    groupsDetailUrl: string;
  };
  widgetTypes: {
    listUrl: string;
    detailUrl: string;
    syncUrl: string;
    organizationConfigurationsListUrl: string;
    organizationConfigurationsDetailUrl: string;
  };
  connections: {
    types: {
      listUrl: string;
      detailUrl: string;
      syncUrl: string;
    };
    instances: {
      listUrl: string;
      detailUrl: string;
      testUrl: string;
      queryUrl: string;
      resourceUrl: string;
      streamUrl: string;
    };
  };
  auth: CommandCenterAuthConfig;
  accessRbac: {
    users: {
      listUrl: string;
    };
  };
  commandCenterAccess: {
    accessPolicies: {
      listUrl: string;
      detailUrl: string;
    };
    users: {
      shellAccessUrl: string;
      shellAccessPreviewUrl: string;
    };
  };
  mainSequence: {
    endpoint: string;
    permissions: {
      candidateUsersSuffix: string;
      canViewSuffix: string;
      canEditSuffix: string;
      addToViewSuffix: string;
      addToEditSuffix: string;
      removeFromViewSuffix: string;
      removeFromEditSuffix: string;
      addTeamToViewSuffix: string;
      addTeamToEditSuffix: string;
      removeTeamFromViewSuffix: string;
      removeTeamFromEditSuffix: string;
    };
  };
  notifications: {
    listUrl: string;
    detailUrl: string;
    markReadUrl: string;
    dismissUrl: string;
    markAllReadUrl: string;
    dismissAllUrl: string;
    type: string;
  };
}

interface SimpleYamlNode {
  [key: string]: string | number | boolean | null | SimpleYamlNode;
}

interface DefaultCommandCenterConfig {
  platform_agent_endpoint: string;
  assistant_ui: {
    endpoint: string;
    protocol: AssistantUiProtocol;
  };
  app: {
    name: string;
    short_name: string;
    notifications_refresh_interval_ms: number;
    cache: {
      app_component_openapi_document_ttl_ms: number;
      app_component_safe_response_ttl_ms: number;
    };
  };
  branding: {
    logo_lightmode: string;
    logo_darkmode: string;
    logo_mark: string;
    logo_alt: string;
    monogram: string;
  };
  preferences: {
    url: string;
    favorites_create_url: string;
    favorites_reorder_url: string;
    favorites_delete_url: string;
  };
  workspaces: {
    list_url: string;
    detail_url: string;
    user_state_list_url: string;
  };
  saved_widgets: {
    instances_list_url: string;
    instances_detail_url: string;
    groups_list_url: string;
    groups_detail_url: string;
  };
  widget_types: {
    list_url: string;
    detail_url: string;
    sync_url: string;
    organization_configurations_list_url: string;
    organization_configurations_detail_url: string;
  };
  connections: {
    types: {
      list_url: string;
      detail_url: string;
      sync_url: string;
    };
    instances: {
      list_url: string;
      detail_url: string;
      test_url: string;
      query_url: string;
      resource_url: string;
      stream_url: string;
    };
  };
  auth: {
    identifier_label: string;
    identifier_placeholder: string;
    jwt: {
      token_url: string;
      refresh_url: string;
      request_fields: {
        identifier: string;
        password: string;
        refresh: string;
      };
      response_fields: {
        access_token: string;
        refresh_token: string;
        token_type: string;
      };
      claim_mapping: {
        user_id: string;
        name: string;
        email: string;
        team: string;
        role: string;
        organization_role: string;
        permissions: string;
        platform_permissions: string;
        is_platform_admin: string;
        date_joined: string;
        is_active: string;
        last_login: string;
        mfa_enabled: string;
        organization_teams: string;
      };
      user_details: {
        url: string;
        response_mapping: {
          user_id: string;
          name: string;
          email: string;
          team: string;
          role: string;
          organization_role: string;
          permissions: string;
          platform_permissions: string;
          is_platform_admin: string;
          date_joined: string;
          is_active: string;
          last_login: string;
          mfa_enabled: string;
          organization_teams: string;
        };
      };
    };
  };
  access_rbac: {
    users: {
      list_url: string;
    };
  };
  command_center_access: {
    access_policies: {
      list_url: string;
      detail_url: string;
    };
    users: {
      shell_access_url: string;
      shell_access_preview_url: string;
    };
  };
  main_sequence: {
    endpoint: string;
    permissions: {
      candidate_users_suffix: string;
      can_view_suffix: string;
      can_edit_suffix: string;
      add_to_view_suffix: string;
      add_to_edit_suffix: string;
      remove_from_view_suffix: string;
      remove_from_edit_suffix: string;
      add_team_to_view_suffix: string;
      add_team_to_edit_suffix: string;
      remove_team_from_view_suffix: string;
      remove_team_from_edit_suffix: string;
    };
  };
  notifications: {
    list_url: string;
    detail_url: string;
    mark_read_url: string;
    dismiss_url: string;
    mark_all_read_url: string;
    dismiss_all_url: string;
    type: string;
  };
}

const brandingAssets = import.meta.glob("../../config/branding/*", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const defaultRawConfig: DefaultCommandCenterConfig = {
  platform_agent_endpoint: "",
  assistant_ui: {
    endpoint: "",
    protocol: "ui-message-stream",
  },
  app: {
    name: "Main Sequence",
    short_name: "Main Sequence",
    notifications_refresh_interval_ms: 300_000,
    cache: {
      app_component_openapi_document_ttl_ms: 300_000,
      app_component_safe_response_ttl_ms: 30_000,
    },
  },
  branding: {
    logo_lightmode: "logo_lightmode.png",
    logo_darkmode: "logo_darkmode.png",
    logo_mark: "logo_mark.png",
    logo_alt: "Main Sequence",
    monogram: "MS",
  },
  preferences: {
    url: "",
    favorites_create_url: "",
    favorites_reorder_url: "",
    favorites_delete_url: "",
  },
  workspaces: {
    list_url: "",
    detail_url: "",
    user_state_list_url: "",
  },
  saved_widgets: {
    instances_list_url: "/api/v1/command_center/saved-widget-instances/",
    instances_detail_url: "/api/v1/command_center/saved-widget-instances/{id}/",
    groups_list_url: "/api/v1/command_center/saved-widget-groups/",
    groups_detail_url: "/api/v1/command_center/saved-widget-groups/{id}/",
  },
  widget_types: {
    list_url: "/api/v1/command_center/widget-types/",
    detail_url: "/api/v1/command_center/widget-types/{id}/",
    sync_url: "/api/v1/command_center/widget-types/sync/",
    organization_configurations_list_url: "/api/v1/command_center/org-widget-type-configurations/",
    organization_configurations_detail_url: "/api/v1/command_center/org-widget-type-configurations/{id}/",
  },
  connections: {
    types: {
      list_url: "/api/v1/command_center/connection-types/",
      detail_url: "/api/v1/command_center/connection-types/{id}/",
      sync_url: "/api/v1/command_center/connection-types/sync/",
    },
    instances: {
      list_url: "/api/v1/command_center/connections/",
      detail_url: "/api/v1/command_center/connections/{uid}/",
      test_url: "/api/v1/command_center/connections/{uid}/test/",
      query_url: "/api/v1/command_center/connections/{uid}/query/",
      resource_url: "/api/v1/command_center/connections/{uid}/resources/{resource}/",
      stream_url: "/api/v1/command_center/connections/{uid}/stream/",
    },
  },
  auth: {
    identifier_label: "Email",
    identifier_placeholder: "Please enter your email",
    jwt: {
      token_url: "/auth/jwt-token/token/",
      refresh_url: "/auth/jwt-token/token/refresh/",
      request_fields: {
        identifier: "email",
        password: "password",
        refresh: "refresh",
      },
      response_fields: {
        access_token: "access",
        refresh_token: "refresh",
        token_type: "token_type",
      },
      claim_mapping: {
        user_id: "sub",
        name: "name",
        email: "email",
        team: "team",
        role: "role",
        organization_role: "organization_role",
        permissions: "permissions",
        platform_permissions: "platform_permissions",
        is_platform_admin: "is_platform_admin",
        date_joined: "date_joined",
        is_active: "is_active",
        last_login: "last_login",
        mfa_enabled: "mfa_enabled",
        organization_teams: "organization_teams",
      },
      user_details: {
        url: "/user/api/user/get_user_details/",
        response_mapping: {
          user_id: "id",
          name: "name",
          email: "email",
          team: "team",
          role: "role",
          organization_role: "organization_role",
          permissions: "permissions",
          platform_permissions: "platform_permissions",
          is_platform_admin: "is_platform_admin",
          date_joined: "date_joined",
          is_active: "is_active",
          last_login: "last_login",
          mfa_enabled: "mfa_enabled",
          organization_teams: "organization_teams",
        },
      },
    },
  },
  access_rbac: {
    users: {
      list_url: "/user/api/user/",
    },
  },
  command_center_access: {
    access_policies: {
      list_url: "/api/v1/command_center/access-policies/",
      detail_url: "/api/v1/command_center/access-policies/{id}/",
    },
    users: {
      shell_access_url: "/api/v1/command_center/users/{user_id}/shell-access/",
      shell_access_preview_url:
        "/api/v1/command_center/users/{user_id}/shell-access/preview/",
    },
  },
  main_sequence: {
    endpoint: "/orm/api/pods/",
    permissions: {
      candidate_users_suffix: "candidate-users/",
      can_view_suffix: "can-view/",
      can_edit_suffix: "can-edit/",
      add_to_view_suffix: "add-to-view/",
      add_to_edit_suffix: "add-to-edit/",
      remove_from_view_suffix: "remove-from-view/",
      remove_from_edit_suffix: "remove-from-edit/",
      add_team_to_view_suffix: "add-team-to-view/",
      add_team_to_edit_suffix: "add-team-to-edit/",
      remove_team_from_view_suffix: "remove-team-from-view/",
      remove_team_from_edit_suffix: "remove-team-from-edit/",
    },
  },
  notifications: {
    list_url: "/user/api/notifications/",
    detail_url: "/user/api/notifications/{id}/",
    mark_read_url: "/user/api/notifications/{id}/mark-read/",
    dismiss_url: "/user/api/notifications/{id}/dismiss/",
    mark_all_read_url: "/user/api/notifications/mark-all-read/",
    dismiss_all_url: "/user/api/notifications/dismiss-all/",
    type: "UR",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseScalar(value: string): string | number | boolean | null {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (["null", "none", "~"].includes(trimmed.toLowerCase())) return null;

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed !== "") {
    return asNumber;
  }

  return trimmed;
}

function parseSimpleYaml(raw: string): SimpleYamlNode {
  const root: SimpleYamlNode = {};
  const stack: Array<{ indent: number; node: SimpleYamlNode }> = [
    { indent: -1, node: root },
  ];

  raw.split(/\r?\n/).forEach((line) => {
    if (!line.trim() || line.trimStart().startsWith("#")) {
      return;
    }

    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1]!.node;

    if (trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1).trim();
      const child: SimpleYamlNode = {};
      current[key] = child;
      stack.push({ indent, node: child });
      return;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    current[key] = parseScalar(value);
  });

  return root;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function readAssistantUiProtocol(
  value: unknown,
  fallback: AssistantUiProtocol,
): AssistantUiProtocol {
  return value === "data-stream" || value === "ui-message-stream" ? value : fallback;
}

function resolveBrandingAsset(fileName: string) {
  const normalizedFileName = fileName.replace(/^\.?\//, "");
  const match = Object.entries(brandingAssets).find(([path]) =>
    path.endsWith(`/${normalizedFileName}`),
  );

  return match?.[1] ?? "";
}

function getNestedObject(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

const parsedConfig = parseSimpleYaml(rawCommandCenterConfig) as Record<string, unknown>;
const parsedApp = getNestedObject(parsedConfig, "app");
const parsedAssistantUi = getNestedObject(parsedConfig, "assistant_ui");
const parsedAppCache = getNestedObject(parsedApp, "cache");
const parsedBranding = getNestedObject(parsedConfig, "branding");
const parsedPreferences = getNestedObject(parsedConfig, "preferences");
const parsedWorkspaces = getNestedObject(parsedConfig, "workspaces");
const parsedSavedWidgets = getNestedObject(parsedConfig, "saved_widgets");
const parsedWidgetTypes = getNestedObject(parsedConfig, "widget_types");
const parsedConnections = getNestedObject(parsedConfig, "connections");
const parsedAuth = getNestedObject(parsedConfig, "auth");
const parsedAccessRbac = getNestedObject(parsedConfig, "access_rbac");
const parsedCommandCenterAccess = getNestedObject(parsedConfig, "command_center_access");
const parsedMainSequence = getNestedObject(parsedConfig, "main_sequence");
const parsedNotifications = getNestedObject(parsedConfig, "notifications");
const parsedAuthJwt = getNestedObject(parsedAuth, "jwt");
const parsedAuthRequestFields = getNestedObject(parsedAuthJwt, "request_fields");
const parsedAuthResponseFields = getNestedObject(parsedAuthJwt, "response_fields");
const parsedAuthClaimMapping = getNestedObject(parsedAuthJwt, "claim_mapping");
const parsedAuthUserDetails = getNestedObject(parsedAuthJwt, "user_details");
const parsedAuthUserDetailsMapping = getNestedObject(parsedAuthUserDetails, "response_mapping");
const parsedAccessRbacUsers = getNestedObject(parsedAccessRbac, "users");
const parsedCommandCenterAccessPolicies = getNestedObject(
  parsedCommandCenterAccess,
  "access_policies",
);
const parsedCommandCenterAccessUsers = getNestedObject(parsedCommandCenterAccess, "users");
const parsedMainSequencePermissions = getNestedObject(parsedMainSequence, "permissions");
const parsedConnectionTypes = getNestedObject(parsedConnections, "types");
const parsedConnectionInstances = getNestedObject(parsedConnections, "instances");

const logoLightmodeFile = readString(
  parsedBranding.logo_lightmode,
  defaultRawConfig.branding.logo_lightmode,
);
const logoDarkmodeFile = readString(
  parsedBranding.logo_darkmode,
  defaultRawConfig.branding.logo_darkmode,
);
const logoMarkFile = readString(
  parsedBranding.logo_mark,
  defaultRawConfig.branding.logo_mark,
);
export const commandCenterConfig: CommandCenterConfig = {
  assistantUi: {
    endpoint: readString(
      rawEnv.VITE_ASSISTANT_UI_ENDPOINT ??
        parsedAssistantUi.endpoint ??
        parsedConfig.platform_agent_endpoint,
      defaultRawConfig.assistant_ui.endpoint,
    ),
    protocol: readAssistantUiProtocol(
      parsedAssistantUi.protocol,
      defaultRawConfig.assistant_ui.protocol,
    ),
  },
  app: {
    name: readString(parsedApp.name, defaultRawConfig.app.name),
    shortName: readString(parsedApp.short_name, defaultRawConfig.app.short_name),
    notificationsRefreshIntervalMs: readNumber(
      parsedApp.notifications_refresh_interval_ms,
      defaultRawConfig.app.notifications_refresh_interval_ms,
    ),
    cache: {
      appComponentOpenApiDocumentTtlMs: readNumber(
        parsedAppCache.app_component_openapi_document_ttl_ms,
        defaultRawConfig.app.cache.app_component_openapi_document_ttl_ms,
      ),
      appComponentSafeResponseTtlMs: readNumber(
        parsedAppCache.app_component_safe_response_ttl_ms,
        defaultRawConfig.app.cache.app_component_safe_response_ttl_ms,
      ),
    },
  },
  branding: {
    logoLightmodeSrc:
      resolveBrandingAsset(logoLightmodeFile) ||
      resolveBrandingAsset(defaultRawConfig.branding.logo_lightmode),
    logoDarkmodeSrc:
      resolveBrandingAsset(logoDarkmodeFile) ||
      resolveBrandingAsset(defaultRawConfig.branding.logo_darkmode),
    logoMarkSrc:
      resolveBrandingAsset(logoMarkFile) ||
      resolveBrandingAsset(defaultRawConfig.branding.logo_mark),
    logoAlt: readString(parsedBranding.logo_alt, defaultRawConfig.branding.logo_alt),
    monogram: readString(parsedBranding.monogram, defaultRawConfig.branding.monogram)
      .slice(0, 3)
      .toUpperCase(),
  },
  preferences: {
    url: readString(parsedPreferences.url, defaultRawConfig.preferences.url),
    favoritesCreateUrl: readString(
      parsedPreferences.favorites_create_url,
      defaultRawConfig.preferences.favorites_create_url,
    ),
    favoritesReorderUrl: readString(
      parsedPreferences.favorites_reorder_url,
      defaultRawConfig.preferences.favorites_reorder_url,
    ),
    favoritesDeleteUrl: readString(
      parsedPreferences.favorites_delete_url,
      defaultRawConfig.preferences.favorites_delete_url,
    ),
  },
  workspaces: {
    listUrl: readString(parsedWorkspaces.list_url, defaultRawConfig.workspaces.list_url),
    detailUrl: readString(parsedWorkspaces.detail_url, defaultRawConfig.workspaces.detail_url),
    userStateListUrl: readString(
      parsedWorkspaces.user_state_list_url,
      defaultRawConfig.workspaces.user_state_list_url,
    ),
  },
  savedWidgets: {
    instancesListUrl: readString(
      parsedSavedWidgets.instances_list_url,
      defaultRawConfig.saved_widgets.instances_list_url,
    ),
    instancesDetailUrl: readString(
      parsedSavedWidgets.instances_detail_url,
      defaultRawConfig.saved_widgets.instances_detail_url,
    ),
    groupsListUrl: readString(
      parsedSavedWidgets.groups_list_url,
      defaultRawConfig.saved_widgets.groups_list_url,
    ),
    groupsDetailUrl: readString(
      parsedSavedWidgets.groups_detail_url,
      defaultRawConfig.saved_widgets.groups_detail_url,
    ),
  },
  widgetTypes: {
    listUrl: readString(parsedWidgetTypes.list_url, defaultRawConfig.widget_types.list_url),
    detailUrl: readString(parsedWidgetTypes.detail_url, defaultRawConfig.widget_types.detail_url),
    syncUrl: readString(parsedWidgetTypes.sync_url, defaultRawConfig.widget_types.sync_url),
    organizationConfigurationsListUrl: readString(
      parsedWidgetTypes.organization_configurations_list_url,
      defaultRawConfig.widget_types.organization_configurations_list_url,
    ),
    organizationConfigurationsDetailUrl: readString(
      parsedWidgetTypes.organization_configurations_detail_url,
      defaultRawConfig.widget_types.organization_configurations_detail_url,
    ),
  },
  connections: {
    types: {
      listUrl: readString(
        parsedConnectionTypes.list_url,
        defaultRawConfig.connections.types.list_url,
      ),
      detailUrl: readString(
        parsedConnectionTypes.detail_url,
        defaultRawConfig.connections.types.detail_url,
      ),
      syncUrl: readString(
        parsedConnectionTypes.sync_url,
        defaultRawConfig.connections.types.sync_url,
      ),
    },
    instances: {
      listUrl: readString(
        parsedConnectionInstances.list_url,
        defaultRawConfig.connections.instances.list_url,
      ),
      detailUrl: readString(
        parsedConnectionInstances.detail_url,
        defaultRawConfig.connections.instances.detail_url,
      ),
      testUrl: readString(
        parsedConnectionInstances.test_url,
        defaultRawConfig.connections.instances.test_url,
      ),
      queryUrl: readString(
        parsedConnectionInstances.query_url,
        defaultRawConfig.connections.instances.query_url,
      ),
      resourceUrl: readString(
        parsedConnectionInstances.resource_url,
        defaultRawConfig.connections.instances.resource_url,
      ),
      streamUrl: readString(
        parsedConnectionInstances.stream_url,
        defaultRawConfig.connections.instances.stream_url,
      ),
    },
  },
  auth: {
    identifierLabel: readString(
      parsedAuth.identifier_label,
      defaultRawConfig.auth.identifier_label,
    ),
    identifierPlaceholder: readString(
      parsedAuth.identifier_placeholder,
      defaultRawConfig.auth.identifier_placeholder,
    ),
    jwt: {
      tokenUrl: readString(parsedAuthJwt.token_url, defaultRawConfig.auth.jwt.token_url),
      refreshUrl: readString(parsedAuthJwt.refresh_url, defaultRawConfig.auth.jwt.refresh_url),
      requestFields: {
        identifier: readString(
          parsedAuthRequestFields.identifier,
          defaultRawConfig.auth.jwt.request_fields.identifier,
        ),
        password: readString(
          parsedAuthRequestFields.password,
          defaultRawConfig.auth.jwt.request_fields.password,
        ),
        refresh: readString(
          parsedAuthRequestFields.refresh,
          defaultRawConfig.auth.jwt.request_fields.refresh,
        ),
      },
      responseFields: {
        accessToken: readString(
          parsedAuthResponseFields.access_token,
          defaultRawConfig.auth.jwt.response_fields.access_token,
        ),
        refreshToken: readString(
          parsedAuthResponseFields.refresh_token,
          defaultRawConfig.auth.jwt.response_fields.refresh_token,
        ),
        tokenType: readString(
          parsedAuthResponseFields.token_type,
          defaultRawConfig.auth.jwt.response_fields.token_type,
        ),
      },
      claimMapping: {
        userId: readString(
          parsedAuthClaimMapping.user_id,
          defaultRawConfig.auth.jwt.claim_mapping.user_id,
        ),
        name: readString(
          parsedAuthClaimMapping.name,
          defaultRawConfig.auth.jwt.claim_mapping.name,
        ),
        email: readString(
          parsedAuthClaimMapping.email,
          defaultRawConfig.auth.jwt.claim_mapping.email,
        ),
        team: readString(
          parsedAuthClaimMapping.team,
          defaultRawConfig.auth.jwt.claim_mapping.team,
        ),
        role: readString(
          parsedAuthClaimMapping.role,
          defaultRawConfig.auth.jwt.claim_mapping.role,
        ),
        organizationRole: readString(
          parsedAuthClaimMapping.organization_role,
          defaultRawConfig.auth.jwt.claim_mapping.organization_role,
        ),
        permissions: readString(
          parsedAuthClaimMapping.permissions,
          defaultRawConfig.auth.jwt.claim_mapping.permissions,
        ),
        platformPermissions: readString(
          parsedAuthClaimMapping.platform_permissions,
          defaultRawConfig.auth.jwt.claim_mapping.platform_permissions,
        ),
        isPlatformAdmin: readString(
          parsedAuthClaimMapping.is_platform_admin,
          defaultRawConfig.auth.jwt.claim_mapping.is_platform_admin,
        ),
        dateJoined: readString(
          parsedAuthClaimMapping.date_joined,
          defaultRawConfig.auth.jwt.claim_mapping.date_joined,
        ),
        isActive: readString(
          parsedAuthClaimMapping.is_active,
          defaultRawConfig.auth.jwt.claim_mapping.is_active,
        ),
        lastLogin: readString(
          parsedAuthClaimMapping.last_login,
          defaultRawConfig.auth.jwt.claim_mapping.last_login,
        ),
        mfaEnabled: readString(
          parsedAuthClaimMapping.mfa_enabled,
          defaultRawConfig.auth.jwt.claim_mapping.mfa_enabled,
        ),
        organizationTeams: readString(
          parsedAuthClaimMapping.organization_teams,
          defaultRawConfig.auth.jwt.claim_mapping.organization_teams,
        ),
      },
      userDetails: {
        url: readString(
          parsedAuthUserDetails.url,
          defaultRawConfig.auth.jwt.user_details.url,
        ),
        responseMapping: {
          userId: readString(
            parsedAuthUserDetailsMapping.user_id,
            defaultRawConfig.auth.jwt.user_details.response_mapping.user_id,
          ),
          name: readString(
            parsedAuthUserDetailsMapping.name,
            defaultRawConfig.auth.jwt.user_details.response_mapping.name,
          ),
          email: readString(
            parsedAuthUserDetailsMapping.email,
            defaultRawConfig.auth.jwt.user_details.response_mapping.email,
          ),
          team: readString(
            parsedAuthUserDetailsMapping.team,
            defaultRawConfig.auth.jwt.user_details.response_mapping.team,
          ),
          role: readString(
            parsedAuthUserDetailsMapping.role,
            defaultRawConfig.auth.jwt.user_details.response_mapping.role,
          ),
          organizationRole: readString(
            parsedAuthUserDetailsMapping.organization_role,
            defaultRawConfig.auth.jwt.user_details.response_mapping.organization_role,
          ),
          permissions: readString(
            parsedAuthUserDetailsMapping.permissions,
            defaultRawConfig.auth.jwt.user_details.response_mapping.permissions,
          ),
          platformPermissions: readString(
            parsedAuthUserDetailsMapping.platform_permissions,
            defaultRawConfig.auth.jwt.user_details.response_mapping.platform_permissions,
          ),
          isPlatformAdmin: readString(
            parsedAuthUserDetailsMapping.is_platform_admin,
            defaultRawConfig.auth.jwt.user_details.response_mapping.is_platform_admin,
          ),
          dateJoined: readString(
            parsedAuthUserDetailsMapping.date_joined,
            defaultRawConfig.auth.jwt.user_details.response_mapping.date_joined,
          ),
          isActive: readString(
            parsedAuthUserDetailsMapping.is_active,
            defaultRawConfig.auth.jwt.user_details.response_mapping.is_active,
          ),
          lastLogin: readString(
            parsedAuthUserDetailsMapping.last_login,
            defaultRawConfig.auth.jwt.user_details.response_mapping.last_login,
          ),
          mfaEnabled: readString(
            parsedAuthUserDetailsMapping.mfa_enabled,
            defaultRawConfig.auth.jwt.user_details.response_mapping.mfa_enabled,
          ),
        organizationTeams: readString(
          parsedAuthUserDetailsMapping.organization_teams,
          defaultRawConfig.auth.jwt.user_details.response_mapping.organization_teams,
        ),
        },
      },
    },
  },
  accessRbac: {
    users: {
      listUrl: readString(
        parsedAccessRbacUsers.list_url,
        defaultRawConfig.access_rbac.users.list_url,
      ),
    },
  },
  commandCenterAccess: {
    accessPolicies: {
      listUrl: readString(
        parsedCommandCenterAccessPolicies.list_url,
        defaultRawConfig.command_center_access.access_policies.list_url,
      ),
      detailUrl: readString(
        parsedCommandCenterAccessPolicies.detail_url,
        defaultRawConfig.command_center_access.access_policies.detail_url,
      ),
    },
    users: {
      shellAccessUrl: readString(
        parsedCommandCenterAccessUsers.shell_access_url,
        defaultRawConfig.command_center_access.users.shell_access_url,
      ),
      shellAccessPreviewUrl: readString(
        parsedCommandCenterAccessUsers.shell_access_preview_url,
        defaultRawConfig.command_center_access.users.shell_access_preview_url,
      ),
    },
  },
  mainSequence: {
    endpoint: readString(
      parsedMainSequence.endpoint,
      defaultRawConfig.main_sequence.endpoint,
    ),
    permissions: {
      candidateUsersSuffix: readString(
        parsedMainSequencePermissions.candidate_users_suffix,
        defaultRawConfig.main_sequence.permissions.candidate_users_suffix,
      ),
      canViewSuffix: readString(
        parsedMainSequencePermissions.can_view_suffix,
        defaultRawConfig.main_sequence.permissions.can_view_suffix,
      ),
      canEditSuffix: readString(
        parsedMainSequencePermissions.can_edit_suffix,
        defaultRawConfig.main_sequence.permissions.can_edit_suffix,
      ),
      addToViewSuffix: readString(
        parsedMainSequencePermissions.add_to_view_suffix,
        defaultRawConfig.main_sequence.permissions.add_to_view_suffix,
      ),
      addToEditSuffix: readString(
        parsedMainSequencePermissions.add_to_edit_suffix,
        defaultRawConfig.main_sequence.permissions.add_to_edit_suffix,
      ),
      removeFromViewSuffix: readString(
        parsedMainSequencePermissions.remove_from_view_suffix,
        defaultRawConfig.main_sequence.permissions.remove_from_view_suffix,
      ),
      removeFromEditSuffix: readString(
        parsedMainSequencePermissions.remove_from_edit_suffix,
        defaultRawConfig.main_sequence.permissions.remove_from_edit_suffix,
      ),
      addTeamToViewSuffix: readString(
        parsedMainSequencePermissions.add_team_to_view_suffix,
        defaultRawConfig.main_sequence.permissions.add_team_to_view_suffix,
      ),
      addTeamToEditSuffix: readString(
        parsedMainSequencePermissions.add_team_to_edit_suffix,
        defaultRawConfig.main_sequence.permissions.add_team_to_edit_suffix,
      ),
      removeTeamFromViewSuffix: readString(
        parsedMainSequencePermissions.remove_team_from_view_suffix,
        defaultRawConfig.main_sequence.permissions.remove_team_from_view_suffix,
      ),
      removeTeamFromEditSuffix: readString(
        parsedMainSequencePermissions.remove_team_from_edit_suffix,
        defaultRawConfig.main_sequence.permissions.remove_team_from_edit_suffix,
      ),
    },
  },
  notifications: {
    listUrl: readString(
      parsedNotifications.list_url,
      defaultRawConfig.notifications.list_url,
    ),
    detailUrl: readString(
      parsedNotifications.detail_url,
      defaultRawConfig.notifications.detail_url,
    ),
    markReadUrl: readString(
      parsedNotifications.mark_read_url,
      defaultRawConfig.notifications.mark_read_url,
    ),
    dismissUrl: readString(
      parsedNotifications.dismiss_url,
      defaultRawConfig.notifications.dismiss_url,
    ),
    markAllReadUrl: readString(
      parsedNotifications.mark_all_read_url,
      defaultRawConfig.notifications.mark_all_read_url,
    ),
    dismissAllUrl: readString(
      parsedNotifications.dismiss_all_url,
      defaultRawConfig.notifications.dismiss_all_url,
    ),
    type: readString(
      parsedNotifications.type,
      defaultRawConfig.notifications.type,
    ),
  },
};
