import { useDeferredValue, useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { MainSequenceRegistryPagination } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../../extensions/main_sequence/common/components/MainSequenceRegistrySearch";
import { mainSequenceRegistryPageSize } from "../../../../../extensions/main_sequence/common/api";

import {
  fetchCurrentOrganizationId,
  listOrganizationLoginSessions,
  revokeOrganizationLoginSession,
  type OrganizationLoginSessionAuthSource,
} from "./api";
import { AdminSurfaceLayout } from "./shared";

function formatAdminError(error: unknown) {
  return error instanceof Error ? error.message : "The organization session request failed.";
}

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatUserDisplayName(user: {
  email: string;
  first_name: string;
  last_name: string;
}) {
  const fullName = [user.first_name, user.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  if (!fullName) {
    return user.email;
  }

  return `${fullName} (${user.email})`;
}

type SessionBooleanFilter = "all" | "true" | "false";
type SessionAuthSourceFilter = "all" | OrganizationLoginSessionAuthSource;

function parseBooleanFilter(value: SessionBooleanFilter) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export function AdminLoginSessionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchValue, setSearchValue] = useState("");
  const [userIdFilterValue, setUserIdFilterValue] = useState("");
  const [authSourceFilter, setAuthSourceFilter] = useState<SessionAuthSourceFilter>("all");
  const [activeFilter, setActiveFilter] = useState<SessionBooleanFilter>("all");
  const [revokedFilter, setRevokedFilter] = useState<SessionBooleanFilter>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const deferredSearchValue = useDeferredValue(searchValue);
  const deferredUserIdFilterValue = useDeferredValue(userIdFilterValue);
  const normalizedSearchValue = deferredSearchValue.trim();
  const normalizedUserIdFilterValue = deferredUserIdFilterValue.trim();
  const parsedUserIdFilter = Number.parseInt(normalizedUserIdFilterValue, 10);
  const userIdFilter =
    normalizedUserIdFilterValue.length > 0 && Number.isFinite(parsedUserIdFilter)
      ? parsedUserIdFilter
      : undefined;

  const organizationIdQuery = useQuery({
    queryKey: ["admin", "organization-id"],
    queryFn: fetchCurrentOrganizationId,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const sessionsQuery = useQuery({
    queryKey: [
      "admin",
      "organization-login-sessions",
      organizationIdQuery.data ?? null,
      pageIndex,
      normalizedSearchValue,
      userIdFilter ?? null,
      authSourceFilter,
      activeFilter,
      revokedFilter,
    ],
    enabled: typeof organizationIdQuery.data === "number",
    queryFn: () =>
      listOrganizationLoginSessions(organizationIdQuery.data!, {
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
        search: normalizedSearchValue || undefined,
        userId: userIdFilter,
        authSource: authSourceFilter === "all" ? undefined : authSourceFilter,
        isActive: parseBooleanFilter(activeFilter),
        isRevoked: parseBooleanFilter(revokedFilter),
      }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      if (!organizationIdQuery.data) {
        throw new Error("Organization id is not available.");
      }

      return revokeOrganizationLoginSession(organizationIdQuery.data, sessionId);
    },
    onSuccess: (session) => {
      toast({
        variant: "success",
        title: "Session revoked",
        description: `${formatUserDisplayName(session.user)} session ${session.id} revoked.`,
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "organization-login-sessions"],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to revoke session",
        description: formatAdminError(error),
      });
    },
    onSettled: () => {
      setRevokingSessionId(null);
    },
  });

  const totalItems = sessionsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / mainSequenceRegistryPageSize));
  const pageRows = sessionsQuery.data?.results ?? [];
  const activeCount = pageRows.filter((session) => session.is_active).length;

  useEffect(() => {
    setPageIndex(0);
  }, [normalizedSearchValue, userIdFilter, authSourceFilter, activeFilter, revokedFilter]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, totalPages]);

  return (
    <AdminSurfaceLayout
      title="Security sessions"
      description="Review organization login sessions and revoke compromised access."
    >
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Organization login sessions</CardTitle>
              <CardDescription>
                Current and historical tracked sessions for users in your organization.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Session filters"
              accessory={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{`${totalItems} sessions`}</Badge>
                  <Badge variant="neutral">{`${activeCount} active on page`}</Badge>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={userIdFilterValue}
                    onChange={(event) => setUserIdFilterValue(event.target.value)}
                    placeholder="User ID"
                    className="h-9 w-28 rounded-[calc(var(--radius)-6px)] border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                  />
                  <Select
                    value={authSourceFilter}
                    className="w-36"
                    onChange={(event) =>
                      setAuthSourceFilter(event.target.value as SessionAuthSourceFilter)}
                  >
                    <option value="all">All sources</option>
                    <option value="jwt">JWT</option>
                    <option value="django_session">Django</option>
                  </Select>
                  <Select
                    value={activeFilter}
                    className="w-32"
                    onChange={(event) =>
                      setActiveFilter(event.target.value as SessionBooleanFilter)}
                  >
                    <option value="all">Any active</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                  <Select
                    value={revokedFilter}
                    className="w-32"
                    onChange={(event) =>
                      setRevokedFilter(event.target.value as SessionBooleanFilter)}
                  >
                    <option value="all">Any revoked</option>
                    <option value="true">Revoked</option>
                    <option value="false">Not revoked</option>
                  </Select>
                </div>
              }
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by user email, user name, ip, or device"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {organizationIdQuery.isLoading || sessionsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organization sessions
              </div>
            </div>
          ) : null}

          {organizationIdQuery.isError || sessionsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatAdminError(organizationIdQuery.error ?? sessionsQuery.error)}
              </div>
            </div>
          ) : null}

          {!organizationIdQuery.isLoading &&
          !sessionsQuery.isLoading &&
          !organizationIdQuery.isError &&
          !sessionsQuery.isError &&
          totalItems === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No sessions found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear filters to review all tracked sessions.
              </p>
            </div>
          ) : null}

          {!organizationIdQuery.isLoading &&
          !sessionsQuery.isLoading &&
          !organizationIdQuery.isError &&
          !sessionsQuery.isError &&
          totalItems > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table
                className="w-full min-w-[1280px] border-separate text-sm"
                style={{ borderSpacing: "0 var(--table-row-gap-y)" }}
              >
                <thead>
                  <tr
                    className="text-left uppercase tracking-[0.18em] text-muted-foreground"
                    style={{ fontSize: "var(--table-meta-font-size)" }}
                  >
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">User</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Session</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Auth</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Login</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">Last seen</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)]">State</th>
                    <th className="px-4 py-[var(--table-standard-header-padding-y)] text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((session) => {
                    const isBusy =
                      revokeSessionMutation.isPending && revokingSessionId === session.id;
                    const canRevoke = session.is_active && !session.is_revoked;

                    return (
                      <tr key={session.id}>
                        <td className="rounded-l-[var(--table-row-radius)] border-y border-l border-border/55 bg-white/[0.02] px-4 py-3 align-top">
                          <div className="font-medium text-foreground">
                            {formatUserDisplayName(session.user)}
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            user #{session.user.id}
                          </div>
                        </td>
                        <td className="border-y border-border/55 bg-white/[0.02] px-4 py-3 align-top">
                          <div className="text-foreground">{session.device_label || "Unknown device"}</div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {session.ip_address || "No IP"}
                          </div>
                          <div className="mt-1 max-w-[420px] truncate text-xs text-muted-foreground" title={session.user_agent}>
                            {session.user_agent || "No user agent"}
                          </div>
                        </td>
                        <td className="border-y border-border/55 bg-white/[0.02] px-4 py-3 align-top">
                          <Badge variant="neutral">{session.auth_source || "unknown"}</Badge>
                        </td>
                        <td className="border-y border-border/55 bg-white/[0.02] px-4 py-3 align-top text-muted-foreground">
                          {formatSessionTimestamp(session.login_time)}
                        </td>
                        <td className="border-y border-border/55 bg-white/[0.02] px-4 py-3 align-top text-muted-foreground">
                          {formatSessionTimestamp(session.last_seen_at)}
                        </td>
                        <td className="border-y border-border/55 bg-white/[0.02] px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={session.is_active ? "success" : "neutral"}>
                              {session.is_active ? "active" : "inactive"}
                            </Badge>
                            <Badge variant={session.is_revoked ? "warning" : "neutral"}>
                              {session.is_revoked ? "revoked" : "not revoked"}
                            </Badge>
                          </div>
                          {session.revoked_reason?.trim() ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {session.revoked_reason}
                            </div>
                          ) : null}
                        </td>
                        <td className="rounded-r-[var(--table-row-radius)] border-y border-r border-border/55 bg-white/[0.02] px-4 py-3 text-right align-top">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canRevoke || revokeSessionMutation.isPending}
                            onClick={() => {
                              setRevokingSessionId(session.id);
                              revokeSessionMutation.mutate(session.id);
                            }}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!organizationIdQuery.isLoading &&
          !sessionsQuery.isLoading &&
          !organizationIdQuery.isError &&
          !sessionsQuery.isError &&
          totalItems > 0 ? (
            <MainSequenceRegistryPagination
              count={totalItems}
              itemLabel="sessions"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>
    </AdminSurfaceLayout>
  );
}
