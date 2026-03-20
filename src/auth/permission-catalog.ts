import { appRegistry } from "@/app/registry";
import {
  CORE_PERMISSION_DEFINITIONS,
  type PermissionDefinition,
} from "@/auth/permissions";

export function getPermissionDefinitions(): PermissionDefinition[] {
  const definitions = new Map<string, PermissionDefinition>();

  CORE_PERMISSION_DEFINITIONS.forEach((definition) => {
    definitions.set(definition.id, definition);
  });

  appRegistry.apps.forEach((app) => {
    app.permissionDefinitions?.forEach((definition) => {
      definitions.set(definition.id, {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        category: definition.category?.trim() || app.title,
      });
    });
  });

  return Array.from(definitions.values());
}
