import { asanaService } from './asana.service';

export type TipoCorrelativo = 'SMAT' | 'SFON' | 'DMAT';

export interface CodigoCorrelativo {
  codigo: string;  // p.ej. "SMAT-2026-0042"
  numero: number;  // 42
  gestion: number; // 2026
}

// El proyecto contiene "CDIMA" en el nombre para quedar excluido del seguimiento
// (Inicio, Reportes y Nueva Solicitud ya filtran esos proyectos).
const PROJECT_NAME = 'CDIMA Configuración';
const TASK_NAME = 'CORRELATIVOS';
const MAX_INTENTOS = 5;

interface ContadorData {
  // gestion (año) → tipo → último número asignado
  contadores: Record<string, Partial<Record<TipoCorrelativo, number>>>;
  ultimaAsignacion?: { token: string; codigo: string; fecha: string };
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function parseContador(notes: string | undefined): ContadorData {
  const m = (notes ?? '').match(/===DATOS_JSON===\s*([\s\S]+?)\s*===FIN_DATOS_JSON===/);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]) as Partial<ContadorData>;
      if (parsed && typeof parsed.contadores === 'object' && parsed.contadores !== null) {
        return { contadores: parsed.contadores, ultimaAsignacion: parsed.ultimaAsignacion };
      }
    } catch {
      // Bloque corrupto: se trata como error para no reiniciar la numeración en silencio
      throw new Error(`El JSON de la tarea "${TASK_NAME}" está dañado. Corrígelo en Asana antes de crear solicitudes.`);
    }
  }
  return { contadores: {} };
}

function serializeContador(data: ContadorData): string {
  return `Contador de códigos correlativos de solicitudes (SMAT / SFON / DMAT).
NO EDITAR MANUALMENTE: el sistema lee y actualiza este bloque al crear cada solicitud.

===DATOS_JSON===
${JSON.stringify(data, null, 2)}
===FIN_DATOS_JSON===`;
}

export function formatCodigo(tipo: TipoCorrelativo, gestion: number, numero: number): string {
  return `${tipo}-${gestion}-${String(numero).padStart(4, '0')}`;
}

/**
 * Asigna códigos correlativos por tipo de solicitud, reiniciando cada gestión (año).
 *
 * El contador vive en la tarea "CORRELATIVOS" del proyecto "CDIMA Configuración".
 * Asana no tiene transacciones: se escribe el contador con un token único y se
 * relee para confirmar que nadie lo sobrescribió; si otro usuario ganó, se reintenta.
 */
class CorrelativosService {
  private taskGid: string | null = null;
  // Serializa las asignaciones hechas desde esta misma pestaña
  private cola: Promise<unknown> = Promise.resolve();

  private async getTaskGid(): Promise<string> {
    if (this.taskGid) return this.taskGid;

    const workspaces = await asanaService.getWorkspaces();
    const cdima = workspaces.find(ws => ws.name === 'CDIMA');
    if (!cdima) throw new Error('No se encontró el workspace CDIMA');

    const projects = await asanaService.getProjects(cdima.gid);
    const project = projects.find(p => normalizar(p.name) === normalizar(PROJECT_NAME));
    if (!project) {
      throw new Error(
        `No se encontró el proyecto "${PROJECT_NAME}" en Asana. Créalo para poder generar los códigos de solicitud.`
      );
    }

    const tasks = await asanaService.getProjectTasks(project.gid);
    let task = tasks.find(t => t.name.trim().toUpperCase() === TASK_NAME);
    if (!task) {
      task = await asanaService.createTask({
        name: TASK_NAME,
        projectGid: project.gid,
        workspaceGid: cdima.gid,
        notes: serializeContador({ contadores: {} }),
      });
    }
    this.taskGid = task.gid;
    return task.gid;
  }

  private async asignar(tipo: TipoCorrelativo): Promise<CodigoCorrelativo> {
    const taskGid = await this.getTaskGid();
    const ahora = new Date();
    const gestion = Number(
      ahora.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/La_Paz' })
    );
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const actual = parseContador((await asanaService.getTask(taskGid)).notes);
      const deGestion = actual.contadores[String(gestion)] ?? {};
      const numero = (deGestion[tipo] ?? 0) + 1;
      const codigo = formatCodigo(tipo, gestion, numero);

      const nuevo: ContadorData = {
        contadores: {
          ...actual.contadores,
          [String(gestion)]: { ...deGestion, [tipo]: numero },
        },
        ultimaAsignacion: { token, codigo, fecha: ahora.toISOString() },
      };
      await asanaService.updateTask(taskGid, { notes: serializeContador(nuevo) });

      // Verificación: si otro usuario escribió entre medias, su token reemplazó al nuestro
      const verificado = parseContador((await asanaService.getTask(taskGid)).notes);
      if (verificado.ultimaAsignacion?.token === token) {
        return { codigo, numero, gestion };
      }
      // Espera aleatoria corta antes de reintentar para no volver a chocar
      await new Promise(r => setTimeout(r, 150 + Math.random() * 350));
    }
    throw new Error('No se pudo generar el código de la solicitud. Intenta nuevamente.');
  }

  /** Reserva y devuelve el siguiente código para el tipo indicado. Lanza si no puede. */
  siguienteCodigo(tipo: TipoCorrelativo): Promise<CodigoCorrelativo> {
    const resultado = this.cola.then(() => this.asignar(tipo));
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}

export const correlativosService = new CorrelativosService();
