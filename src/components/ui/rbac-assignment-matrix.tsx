import { type ReactNode, useEffect, useMemo, useState } from "react";

import { ArrowLeft, ArrowRight, Users2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type RbacEntityId = string | number;

export interface RbacAssignableUser {
  id: RbacEntityId;
  email: string;
  name?: string;
  roleLabel?: string;
  description?: string;
}

export interface RbacAssignableTeam {
  id: RbacEntityId;
  name: string;
  memberCount?: number;
  description?: string;
}

export interface RbacScopeSelection {
  userIds: RbacEntityId[];
  teamIds: RbacEntityId[];
}

export type RbacAssignmentValue = Record<string, RbacScopeSelection>;

export interface RbacAssignmentScope {
  id: string;
  title: string;
  description?: string;
  userHelperText?: string;
  teamHelperText?: string;
}

interface RbacAssignmentNotice {
  badgeLabel: string;
  message: ReactNode;
  tone?: "neutral" | "primary" | "secondary" | "success" | "warning" | "danger";
}

interface RbacAssignmentMatrixProps {
  className?: string;
  defaultValue?: RbacAssignmentValue;
  notice?: RbacAssignmentNotice | false;
  onChange?: (value: RbacAssignmentValue) => void;
  scopes: RbacAssignmentScope[];
  teams: RbacAssignableTeam[];
  users: RbacAssignableUser[];
  value?: RbacAssignmentValue;
}

interface TransferDisplayItem {
  id: RbacEntityId;
  key: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

function toItemKey(id: RbacEntityId) {
  return String(id);
}

function uniqueIds(ids: RbacEntityId[]) {
  const seen = new Set<string>();

  return ids.filter((id) => {
    const key = toItemKey(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeAssignmentValue(
  scopes: RbacAssignmentScope[],
  value: RbacAssignmentValue | undefined,
  validUserKeys: Set<string>,
  validTeamKeys: Set<string>,
) {
  return Object.fromEntries(
    scopes.map((scope) => {
      const scopeValue = value?.[scope.id];

      return [
        scope.id,
        {
          userIds: uniqueIds(scopeValue?.userIds ?? []).filter((id) => validUserKeys.has(toItemKey(id))),
          teamIds: uniqueIds(scopeValue?.teamIds ?? []).filter((id) => validTeamKeys.has(toItemKey(id))),
        },
      ];
    }),
  ) as RbacAssignmentValue;
}

function resolveAssignmentValue(
  updater: RbacAssignmentValue | ((previous: RbacAssignmentValue) => RbacAssignmentValue),
  previous: RbacAssignmentValue,
) {
  return typeof updater === "function" ? updater(previous) : updater;
}

function toggleActiveKey(activeKeys: string[], key: string) {
  return activeKeys.includes(key)
    ? activeKeys.filter((candidate) => candidate !== key)
    : [...activeKeys, key];
}

const defaultRbacAssignmentNotice: RbacAssignmentNotice = {
  badgeLabel: "Org Admin",
  message:
    "Organization admins always have view and edit access, even if they are not explicitly selected below.",
  tone: "primary",
};

function TransferListPane({
  activeKeys,
  emptyText,
  items,
  label,
  onToggle,
}: {
  activeKeys: string[];
  emptyText: string;
  items: TransferDisplayItem[];
  label: string;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="min-h-[220px] rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-2">
        {items.length ? (
          <div className="space-y-1">
            {items.map((item) => {
              const active = activeKeys.includes(item.key);

              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius)-8px)] px-3 py-2 text-left transition-colors",
                    active
                      ? "bg-primary/12 text-foreground"
                      : "text-muted-foreground hover:bg-muted/55 hover:text-foreground",
                  )}
                  onClick={() => {
                    onToggle(item.key);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    {item.subtitle ? (
                      <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                    ) : null}
                  </span>
                  {item.meta ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{item.meta}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[204px] items-center justify-center rounded-[calc(var(--radius)-8px)] border border-dashed border-border/60 px-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

function RbacTransferSection({
  availableItems,
  helperText,
  label,
  onChange,
  selectedItems,
}: {
  availableItems: TransferDisplayItem[];
  helperText?: string;
  label: string;
  onChange: (nextIds: RbacEntityId[]) => void;
  selectedItems: TransferDisplayItem[];
}) {
  const [availableActiveKeys, setAvailableActiveKeys] = useState<string[]>([]);
  const [selectedActiveKeys, setSelectedActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    const availableKeys = new Set(availableItems.map((item) => item.key));
    const selectedKeys = new Set(selectedItems.map((item) => item.key));

    setAvailableActiveKeys((current) => current.filter((key) => availableKeys.has(key)));
    setSelectedActiveKeys((current) => current.filter((key) => selectedKeys.has(key)));
  }, [availableItems, selectedItems]);

  function moveAvailableToSelected(moveAll: boolean) {
    const keysToMove = moveAll
      ? availableItems.map((item) => item.key)
      : availableActiveKeys;

    if (!keysToMove.length) {
      return;
    }

    const nextItems = [
      ...selectedItems.map((item) => item.id),
      ...availableItems
        .filter((item) => keysToMove.includes(item.key))
        .map((item) => item.id),
    ];

    onChange(uniqueIds(nextItems));
    setAvailableActiveKeys([]);
  }

  function moveSelectedToAvailable(moveAll: boolean) {
    const keysToMove = moveAll
      ? selectedItems.map((item) => item.key)
      : selectedActiveKeys;

    if (!keysToMove.length) {
      return;
    }

    onChange(selectedItems.filter((item) => !keysToMove.includes(item.key)).map((item) => item.id));
    setSelectedActiveKeys([]);
  }

  return (
    <section className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)]">
        <TransferListPane
          label="Available"
          items={availableItems}
          activeKeys={availableActiveKeys}
          emptyText={`No available ${label.toLowerCase()}.`}
          onToggle={(key) => {
            setAvailableActiveKeys((current) => toggleActiveKey(current, key));
          }}
        />

        <div className="flex flex-col justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!availableActiveKeys.length}
            onClick={() => {
              moveAvailableToSelected(false);
            }}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!availableItems.length}
            onClick={() => {
              moveAvailableToSelected(true);
            }}
          >
            &gt;&gt;
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedActiveKeys.length}
            onClick={() => {
              moveSelectedToAvailable(false);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!selectedItems.length}
            onClick={() => {
              moveSelectedToAvailable(true);
            }}
          >
            &lt;&lt;
          </Button>
        </div>

        <TransferListPane
          label="Selected"
          items={selectedItems}
          activeKeys={selectedActiveKeys}
          emptyText={`No selected ${label.toLowerCase()}.`}
          onToggle={(key) => {
            setSelectedActiveKeys((current) => toggleActiveKey(current, key));
          }}
        />
      </div>

      {helperText ? <div className="text-sm text-muted-foreground">{helperText}</div> : null}
    </section>
  );
}

export function RbacAssignmentMatrix({
  className,
  defaultValue,
  notice = defaultRbacAssignmentNotice,
  onChange,
  scopes,
  teams,
  users,
  value,
}: RbacAssignmentMatrixProps) {
  const userItems = useMemo<TransferDisplayItem[]>(
    () =>
      users.map((user) => ({
        id: user.id,
        key: toItemKey(user.id),
        title: user.email,
        subtitle: user.name,
        meta: user.roleLabel ? `[${user.roleLabel}]` : undefined,
      })),
    [users],
  );
  const teamItems = useMemo<TransferDisplayItem[]>(
    () =>
      teams.map((team) => ({
        id: team.id,
        key: toItemKey(team.id),
        title: team.memberCount ? `${team.name} (${team.memberCount} members)` : team.name,
        subtitle: team.description,
      })),
    [teams],
  );

  const validUserKeys = useMemo(() => new Set(userItems.map((item) => item.key)), [userItems]);
  const validTeamKeys = useMemo(() => new Set(teamItems.map((item) => item.key)), [teamItems]);

  const [internalValue, setInternalValue] = useState<RbacAssignmentValue>(() =>
    normalizeAssignmentValue(scopes, defaultValue, validUserKeys, validTeamKeys),
  );

  const resolvedValue = useMemo(
    () =>
      normalizeAssignmentValue(
        scopes,
        value ?? internalValue,
        validUserKeys,
        validTeamKeys,
      ),
    [internalValue, scopes, validTeamKeys, validUserKeys, value],
  );

  function updateValue(
    updater: RbacAssignmentValue | ((previous: RbacAssignmentValue) => RbacAssignmentValue),
  ) {
    const nextValue = normalizeAssignmentValue(
      scopes,
      resolveAssignmentValue(updater, resolvedValue),
      validUserKeys,
      validTeamKeys,
    );

    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  return (
    <div className={cn("grid gap-6 xl:grid-cols-2", className)}>
      {notice ? (
        <div className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-3 rounded-[calc(var(--radius)-4px)] border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <Badge variant={notice.tone ?? "primary"}>{notice.badgeLabel}</Badge>
            <span>{notice.message}</span>
          </div>
        </div>
      ) : null}

      {scopes.map((scope) => {
        const selection = resolvedValue[scope.id] ?? { userIds: [], teamIds: [] };
        const selectedUserKeys = new Set(selection.userIds.map((id) => toItemKey(id)));
        const selectedTeamKeys = new Set(selection.teamIds.map((id) => toItemKey(id)));
        const selectedUsers = selection.userIds
          .map((id) => userItems.find((item) => item.key === toItemKey(id)))
          .filter((item): item is TransferDisplayItem => Boolean(item));
        const selectedTeams = selection.teamIds
          .map((id) => teamItems.find((item) => item.key === toItemKey(id)))
          .filter((item): item is TransferDisplayItem => Boolean(item));
        const availableUsers = userItems.filter((item) => !selectedUserKeys.has(item.key));
        const availableTeams = teamItems.filter((item) => !selectedTeamKeys.has(item.key));

        return (
          <Card key={scope.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle>{scope.title}</CardTitle>
              {scope.description ? <CardDescription>{scope.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-6">
              <RbacTransferSection
                label="Users"
                availableItems={availableUsers}
                selectedItems={selectedUsers}
                helperText={scope.userHelperText}
                onChange={(nextUserIds) => {
                  updateValue((current) => ({
                    ...current,
                    [scope.id]: {
                      ...(current[scope.id] ?? { userIds: [], teamIds: [] }),
                      userIds: nextUserIds,
                    },
                  }));
                }}
              />

              <div className="border-t border-dashed border-border/70" />

              <RbacTransferSection
                label="Teams"
                availableItems={availableTeams}
                selectedItems={selectedTeams}
                helperText={scope.teamHelperText}
                onChange={(nextTeamIds) => {
                  updateValue((current) => ({
                    ...current,
                    [scope.id]: {
                      ...(current[scope.id] ?? { userIds: [], teamIds: [] }),
                      teamIds: nextTeamIds,
                    },
                  }));
                }}
              />
            </CardContent>
          </Card>
        );
      })}

      {!scopes.length ? (
        <Card className="xl:col-span-2">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-muted/45 text-muted-foreground">
              <Users2 className="h-5 w-5" />
            </div>
            <div className="text-base font-medium text-foreground">No RBAC scopes configured</div>
            <div className="max-w-[460px] text-sm text-muted-foreground">
              Provide at least one scope definition to render the assignment matrix.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
