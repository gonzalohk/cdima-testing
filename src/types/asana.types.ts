// Tipos de Asana API
export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  resource_type: string;
}

export interface CustomFieldEnumOption {
  gid: string;
  name: string;
  color: string;
  enabled: boolean;
  resource_type: string;
}

export interface CustomField {
  gid: string;
  name: string;
  type: 'enum' | 'multi_enum' | 'number' | 'text' | 'date' | 'people';
  display_value?: string | null;
  enum_value?: CustomFieldEnumOption | null;
  multi_enum_values?: CustomFieldEnumOption[];
  number_value?: number | null;
  text_value?: string | null;
  enabled: boolean;
  resource_subtype: string;
  resource_type: string;
}

export interface AsanaSection {
  gid: string;
  name: string;
  resource_type: string;
  project: {
    gid: string;
    name: string;
  };
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  color?: string;
  workspace?: {
    gid: string;
    name: string;
  };
  sections?: AsanaSection[];
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  due_on?: string;
  assignee?: AsanaUser | null;
  parent?: {
    gid: string;
    name: string;
  } | null;
  workspace?: {
    gid: string;
    name: string;
  };
  projects?: AsanaProject[];
  num_subtasks?: number;
  memberships?: Array<{
    project: { gid: string; name: string };
    section: { gid: string; name: string };
  }>;
  custom_fields?: CustomField[];
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
  resource_type: string;
}

// Tipos para estadísticas
export interface TaskStatistics {
  total: number;
  completed: number;
  pending: number;
  completionPercentage: number;
  byAssignee: {
    [assigneeName: string]: {
      total: number;
      completed: number;
      pending: number;
    };
  };
  byResponsable: {
    [responsableName: string]: {
      total: number;
      completed: number;
      pending: number;
    };
  };
}

// Configuración de API
export interface AsanaConfig {
  personalAccessToken: string;
  workspace?: string;
}
