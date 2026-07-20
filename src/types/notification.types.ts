export type NotificationType =
  | 'solicitud_creada'
  | 'solicitud_aprobada'
  | 'solicitud_observada';

// Estructura que se guarda dentro del JSON de la tarea de notificación.
export interface NotificationJsonData {
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string; // ISO
  sourceTaskGid: string; // solicitud/tarea a la que apunta
  targetEmail: string; // UN destinatario
}

// Estructura que consume la interfaz.
export interface AppNotification {
  gid: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  sourceTaskGid: string;
  read: boolean;
}
