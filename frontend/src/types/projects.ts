export type ProjectStage = 'planning' | 'construction' | 'completed' | 'archived';
export type ProjectStatus = 'active' | 'archived' | 'deleted';

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  region?: string | null;
  locationText?: string | null;
  stage: ProjectStage;
  status: ProjectStatus;
  plannedOnlineAt?: string | null;
  description?: string | null;
  defaultLayoutId?: string | null;
  layoutCount?: number;
  deviceCount?: number;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface ProjectListTotals {
  total: number;
  active: number;
  archived: number;
  deleted: number;
}

export interface ProjectListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProjectListResponse {
  items: ProjectListItem[];
  meta: ProjectListMeta;
  totals: ProjectListTotals;
}

export interface ProjectLocationPayload {
  text?: string;
  lat?: number;
  lng?: number;
}

export interface CreateProjectPayload {
  name: string;
  code: string;
  region?: string;
  location?: ProjectLocationPayload;
  stage?: ProjectStage;
  plannedOnlineAt?: string | null;
  description?: string;
  includeDefaultMembership?: boolean;
  createdBy?: string;
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  status?: ProjectStatus;
}

export interface DeleteProjectOptions {
  reason?: string;
  archiveLayouts?: boolean;
  keepDeviceMappings?: boolean;
}
