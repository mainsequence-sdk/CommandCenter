export interface VisibleNotificationContract {
  id: string | number;
  type: string;
  created_at: string;
  title: string;
  description: string;
  meta_data: Record<string, unknown> | null;
  is_global: boolean;
  target_user: string | number | null;
  target_distribution_list: string | number | null;
  include_email: boolean;
  is_read: boolean;
}

export type AppNotificationQueryValue = string | number | boolean | null | undefined;

export interface AppNotificationSourceDefinition {
  id: string;
  title?: string;
  baseUrl?: string;
  listPath: string;
  detailPath?: string;
  markReadPath?: string;
  dismissPath?: string;
  markAllReadPath?: string;
  dismissAllPath?: string;
  listQuery?: Record<string, AppNotificationQueryValue>;
}

export interface ResolvedAppNotificationSource extends AppNotificationSourceDefinition {
  app_id: string;
  app_title: string;
  app_source: string;
  source_key: string;
}

export interface VisibleAppNotification extends VisibleNotificationContract {
  app_id: string;
  app_title: string;
  app_source: string;
  notification_key: string;
  source_id: string;
  source_title: string;
  source_key: string;
  source_base_url?: string;
  detail_path?: string;
  mark_read_path?: string;
  dismiss_path?: string;
}
