import { asanaService } from './asana.service';
import config from '../config/env';
import {
  AppNotification,
  NotificationJsonData,
  NotificationType,
} from '../types/notification.types';

const PROJECT_NAME = 'NOTIFICACIONES';
const PURGE_DAYS = 30;

function extractJson(notes: string | undefined): NotificationJsonData | null {
  if (!notes) return null;
  const m = notes.match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as NotificationJsonData;
  } catch {
    return null;
  }
}

/**
 * Servicio de notificaciones basado en Asana.
 *
 * Todo está protegido por la bandera `config.notificacionesEnabled`
 * (VITE_NOTIFICACIONES_ENABLED === 'true'). Si está desactivada, cada método
 * es un no-op y no realiza ninguna llamada a la API, por lo que la aplicación
 * se comporta exactamente igual que antes.
 *
 * Modelo: una tarea de Asana por destinatario dentro del proyecto
 * "NOTIFICACIONES". "Leída" = tarea completada. Las leídas se purgan tras
 * PURGE_DAYS días.
 */
class NotificationsService {
  private enabled = config.notificacionesEnabled;
  private wsGid: string | null = null;
  private projectGid: string | null = null;

  isEnabled(): boolean {
    return this.enabled;
  }

  private async getContext(): Promise<{ ws: string; project: string } | null> {
    if (!this.enabled) return null;
    try {
      if (!this.wsGid) {
        const wss = await asanaService.getWorkspaces();
        const cdima = wss.find((w) => w.name === 'CDIMA');
        if (!cdima) return null;
        this.wsGid = cdima.gid;
      }
      if (!this.projectGid) {
        const projects = await asanaService.getProjects(this.wsGid);
        const proj = projects.find((p) => p.name.toUpperCase() === PROJECT_NAME);
        if (!proj) return null; // si el proyecto no existe, no rompe nada
        this.projectGid = proj.gid;
      }
      return { ws: this.wsGid, project: this.projectGid };
    } catch (err) {
      console.error('[notificaciones] getContext error:', err);
      return null;
    }
  }

  /**
   * Crea una tarea de notificación por cada destinatario. Nunca lanza.
   */
  async notify(input: {
    type: NotificationType;
    title: string;
    description: string;
    sourceTaskGid: string;
    targetEmails: string[];
  }): Promise<void> {
    if (!this.enabled) return;
    try {
      const ctx = await this.getContext();
      if (!ctx) return;
      const createdAt = new Date().toISOString();
      const emails = Array.from(new Set(input.targetEmails.filter(Boolean)));
      await Promise.all(
        emails.map((email) => {
          const data: NotificationJsonData = {
            type: input.type,
            title: input.title,
            description: input.description,
            createdAt,
            sourceTaskGid: input.sourceTaskGid,
            targetEmail: email,
          };
          const notes = `Notificación automática\n\n===DATOS_JSON===\n${JSON.stringify(
            data,
            null,
            2
          )}\n===FIN_DATOS_JSON===`;
          return asanaService.createTask({
            name: input.title,
            projectGid: ctx.project,
            workspaceGid: ctx.ws,
            notes,
          });
        })
      );
    } catch (err) {
      console.error('[notificaciones] notify error:', err);
    }
  }

  /**
   * Lista las notificaciones del usuario indicado (ordenadas desc) y purga
   * las leídas (completadas) más antiguas que PURGE_DAYS. Nunca lanza.
   */
  async list(email: string): Promise<AppNotification[]> {
    if (!this.enabled) return [];
    try {
      const ctx = await this.getContext();
      if (!ctx) return [];
      const tasks = await asanaService.getProjectTasks(ctx.project);
      const limite = Date.now() - PURGE_DAYS * 86_400_000;
      const purgar: string[] = [];
      const mias: AppNotification[] = [];

      for (const t of tasks) {
        const d = extractJson(t.notes);
        if (!d) continue;
        const createdMs = d.createdAt ? new Date(d.createdAt).getTime() : 0;

        // Purga global de notificaciones leídas (completadas) y antiguas.
        if (t.completed && createdMs < limite) {
          purgar.push(t.gid);
          continue;
        }
        if (d.targetEmail.toLowerCase() !== email.toLowerCase()) continue;

        mias.push({
          gid: t.gid,
          type: d.type,
          title: d.title,
          description: d.description,
          createdAt: d.createdAt,
          sourceTaskGid: d.sourceTaskGid,
          read: !!t.completed,
        });
      }

      if (purgar.length) {
        await Promise.all(
          purgar.map((gid) => asanaService.deleteTask(gid).catch(() => undefined))
        );
      }

      return mias.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err) {
      console.error('[notificaciones] list error:', err);
      return [];
    }
  }

  /**
   * Marca una notificación como leída (completa la tarea). Nunca lanza.
   */
  async markRead(gid: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await asanaService.updateTask(gid, { completed: true });
    } catch (err) {
      console.error('[notificaciones] markRead error:', err);
    }
  }
}

export const notificationsService = new NotificationsService();
