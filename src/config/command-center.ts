import rawCommandCenterConfig from "../../config/command-center.yaml?raw";

export const commandCenterConfigSource = rawCommandCenterConfig.trim();

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
      permissions: string;
      dateJoined: string;
      isActive: string;
      lastLogin: string;
      mfaEnabled: string;
      organizationTeams: string;
    };
    userDetails: {
      url: string;
      groupsUrl: string;
      responseMapping: {
        userId: string;
        name: string;
        email: string;
        team: string;
        role: string;
        permissions: string;
        groups: string;
        dateJoined: string;
        isActive: string;
        lastLogin: string;
        mfaEnabled: string;
        organizationTeams: string;
      };
      roleGroups: {
        admin: string;
        user: string;
      };
    };
  };
}

export interface CommandCenterConfig {
  app: {
    name: string;
    shortName: string;
    notificationsRefreshIntervalMs: number;
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
  };
  auth: CommandCenterAuthConfig;
  accessRbac: {
    users: {
      listUrl: string;
    };
    groups: {
      listUrl: string;
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
  app: {
    name: string;
    short_name: string;
    notifications_refresh_interval_ms: number;
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
        permissions: string;
        date_joined: string;
        is_active: string;
        last_login: string;
        mfa_enabled: string;
        organization_teams: string;
      };
      user_details: {
        url: string;
        groups_url: string;
        response_mapping: {
          user_id: string;
          name: string;
          email: string;
          team: string;
          role: string;
          permissions: string;
          groups: string;
          date_joined: string;
          is_active: string;
          last_login: string;
          mfa_enabled: string;
          organization_teams: string;
        };
        role_groups: {
          admin: string;
          user: string;
        };
      };
    };
  };
  access_rbac: {
    users: {
      list_url: string;
    };
    groups: {
      list_url: string;
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
  app: {
    name: "Main Sequence Command Center",
    short_name: "Main Sequence",
    notifications_refresh_interval_ms: 300_000,
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
        permissions: "permissions",
        date_joined: "date_joined",
        is_active: "is_active",
        last_login: "last_login",
        mfa_enabled: "mfa_enabled",
        organization_teams: "organization_teams",
      },
      user_details: {
        url: "/user/api/user/get_user_details/",
        groups_url: "/user/api/user/get_user_details/",
        response_mapping: {
          user_id: "id",
          name: "name",
          email: "email",
          team: "team",
          role: "role",
          permissions: "permissions",
          groups: "groups",
          date_joined: "date_joined",
          is_active: "is_active",
          last_login: "last_login",
          mfa_enabled: "mfa_enabled",
          organization_teams: "organization_teams",
        },
        role_groups: {
          admin: "Organization Admin",
          user: "",
        },
      },
    },
  },
  access_rbac: {
    users: {
      list_url: "/user/api/user/",
    },
    groups: {
      list_url: "/user/api/user/get_rbac_groups/",
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
const parsedBranding = getNestedObject(parsedConfig, "branding");
const parsedPreferences = getNestedObject(parsedConfig, "preferences");
const parsedWorkspaces = getNestedObject(parsedConfig, "workspaces");
const parsedAuth = getNestedObject(parsedConfig, "auth");
const parsedAccessRbac = getNestedObject(parsedConfig, "access_rbac");
const parsedMainSequence = getNestedObject(parsedConfig, "main_sequence");
const parsedNotifications = getNestedObject(parsedConfig, "notifications");
const parsedAuthJwt = getNestedObject(parsedAuth, "jwt");
const parsedAuthRequestFields = getNestedObject(parsedAuthJwt, "request_fields");
const parsedAuthResponseFields = getNestedObject(parsedAuthJwt, "response_fields");
const parsedAuthClaimMapping = getNestedObject(parsedAuthJwt, "claim_mapping");
const parsedAuthUserDetails = getNestedObject(parsedAuthJwt, "user_details");
const parsedAuthUserDetailsMapping = getNestedObject(parsedAuthUserDetails, "response_mapping");
const parsedAuthUserDetailsRoleGroups = getNestedObject(parsedAuthUserDetails, "role_groups");
const parsedAccessRbacUsers = getNestedObject(parsedAccessRbac, "users");
const parsedAccessRbacGroups = getNestedObject(parsedAccessRbac, "groups");
const parsedMainSequencePermissions = getNestedObject(parsedMainSequence, "permissions");

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
  app: {
    name: readString(parsedApp.name, defaultRawConfig.app.name),
    shortName: readString(parsedApp.short_name, defaultRawConfig.app.short_name),
    notificationsRefreshIntervalMs: readNumber(
      parsedApp.notifications_refresh_interval_ms,
      defaultRawConfig.app.notifications_refresh_interval_ms,
    ),
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
        permissions: readString(
          parsedAuthClaimMapping.permissions,
          defaultRawConfig.auth.jwt.claim_mapping.permissions,
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
        groupsUrl: readString(
          parsedAuthUserDetails.groups_url,
          defaultRawConfig.auth.jwt.user_details.groups_url,
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
          permissions: readString(
            parsedAuthUserDetailsMapping.permissions,
            defaultRawConfig.auth.jwt.user_details.response_mapping.permissions,
          ),
          groups: readString(
            parsedAuthUserDetailsMapping.groups,
            defaultRawConfig.auth.jwt.user_details.response_mapping.groups,
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
        roleGroups: {
          admin: readString(
            parsedAuthUserDetailsRoleGroups.admin,
            defaultRawConfig.auth.jwt.user_details.role_groups.admin,
          ),
          user: readString(
            parsedAuthUserDetailsRoleGroups.user,
            defaultRawConfig.auth.jwt.user_details.role_groups.user,
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
    groups: {
      listUrl: readString(
        parsedAccessRbacGroups.list_url,
        defaultRawConfig.access_rbac.groups.list_url,
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
