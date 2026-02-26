# Arquitectura Visual - ReportPage

## 🏛️ Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         ReportPage.tsx                          │
│                    (Componente Contenedor)                      │
│                          91 líneas                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ usa
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      useReportPage()                            │
│                      Custom Hook                                │
│                       229 líneas                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Estado                                                   │  │
│  │ • workspaces, projects, mainTasks, subtasks             │  │
│  │ • selectedWorkspace, selectedProject, selectedMainTask  │  │
│  │ • searchTerm, statusFilter, assigneeFilter              │  │
│  │ • loading, error                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Lógica                                                   │  │
│  │ • loadWorkspaces(), loadProjects(), loadMainTasks()     │  │
│  │ • loadTaskDetails() - async + Promise.all               │  │
│  │ • Cálculo de estadísticas (useMemo)                     │  │
│  │ • Filtrado de subtareas (useMemo)                       │  │
│  │ • handleWorkspaceChange(), handleProjectChange()        │  │
│  │ • handleExportPDF()                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ retorna estado y métodos
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ReportPage renderiza:                         │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─► HierarchicalSelector (87 líneas)
         │   └─► Selectores: Workspace → Proyecto → Actividad
         │
         ├─► TaskInfo (63 líneas)
         │   └─► Información de la actividad principal
         │
         ├─► StatisticsSection (78 líneas)
         │   └─► Estadísticas y progreso
         │
         └─► SubtasksTable (112 líneas)
             └─► Tabla de subtareas + Filtros + Exportar PDF
```

---

## 🔄 Flujo de Datos (Data Flow)

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Usuario selecciona Workspace                                │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  HierarchicalSelector.onWorkspaceChange(value)                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  useReportPage.handleWorkspaceChange(value)                     │
│  ├─► setSelectedWorkspace(value)                                │
│  └─► loadProjects(value)                                        │
│       ├─► asanaService.getProjects(workspaceGid)                │
│       └─► setProjects(data)                                     │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  ReportPage re-renderiza con nuevos datos                       │
│  HierarchicalSelector recibe projects y se actualiza            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. Usuario selecciona Proyecto                                 │
│  3. Usuario selecciona Actividad                                │
│  4. Hook carga detalles + subtareas (paralelo)                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  useMemo calcula estadísticas automáticamente                   │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Componentes visuales se renderizan:                            │
│  • TaskInfo                                                      │
│  • StatisticsSection                                             │
│  • SubtasksTable                                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Dependencias entre Componentes

```
ReportPage.tsx
    │
    ├── Importa: useReportPage (hook)
    │       └── Importa: asanaService, exportToPDF, types
    │
    ├── Importa: HierarchicalSelector
    │       └── Recibe: workspaces, projects, mainTasks, handlers
    │
    ├── Importa: TaskInfo
    │       └── Recibe: task, subtasksCount
    │
    ├── Importa: StatisticsSection
    │       └── Recibe: statistics
    │
    └── Importa: SubtasksTable
            └── Recibe: filteredSubtasks, filters, handlers


Ningún componente presentacional importa hooks ni servicios
```

---

## 🎯 Patrón de Props (Props Drilling)

```
useReportPage Hook
    │
    │ retorna { workspaces, projects, ... }
    ▼
ReportPage
    │
    ├─► HierarchicalSelector
    │   ├─ workspaces: AsanaWorkspace[]
    │   ├─ projects: AsanaProject[]
    │   ├─ onWorkspaceChange: (value: string) => void
    │   └─ ...
    │
    ├─► TaskInfo
    │   ├─ task: AsanaTask
    │   └─ subtasksCount: number
    │
    ├─► StatisticsSection
    │   └─ statistics: TaskStatistics
    │
    └─► SubtasksTable
        ├─ filteredSubtasks: AsanaTask[]
        ├─ onSearchChange: (value: string) => void
        └─ ...
```

---

## 🧩 Responsabilidades por Capa

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE LÓGICA                           │
│                   (Custom Hook)                             │
├─────────────────────────────────────────────────────────────┤
│ • Gestión de estado                                         │
│ • Llamadas a API                                            │
│ • Cálculos y transformaciones                               │
│ • Efectos side effects                                      │
│ • Validaciones de negocio                                   │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ expone estado y métodos
                          │
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE COMPOSICIÓN                        │
│                (Container Component)                        │
├─────────────────────────────────────────────────────────────┤
│ • Usa el hook                                               │
│ • Coordina componentes                                      │
│ • Pasa props                                                │
│ • Estructura la página                                      │
└─────────────────────────────────────────────────────────────┘
                          │ pasa props
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               CAPA DE PRESENTACIÓN                          │
│           (Presentational Components)                       │
├─────────────────────────────────────────────────────────────┤
│ • Solo renderización                                        │
│ • Sin estado propio                                         │
│ • Sin llamadas a API                                        │
│ • Recibe todo por props                                     │
│ • Emite eventos vía callbacks                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Comparación Visual

### ANTES (Monolítico)

```
┌───────────────────────────────────────┐
│     ReportPage.tsx (493 líneas)       │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Estado + Lógica + Vista TODO    │  │
│  │                                 │  │
│  │ • useState x10                  │  │
│  │ • useEffect                     │  │
│  │ • Funciones async               │  │
│  │ • useMemo x3                    │  │
│  │ • Handlers x3                   │  │
│  │ • JSX gigante (300+ líneas)    │  │
│  │                                 │  │
│  │ ❌ Difícil de mantener          │  │
│  │ ❌ Difícil de testear           │  │
│  │ ❌ No reutilizable              │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### DESPUÉS (Modular)

```
┌────────────────────────────────────────────────────────────┐
│                    useReportPage.ts                        │
│                      (229 líneas)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ SOLO LÓGICA                                       │  │
│  │ • Estado centralizado                                │  │
│  │ • Funciones bien organizadas                         │  │
│  │ • Cálculos optimizados                               │  │
│  │ • Fácil de testear                                   │  │
│  │ • Reutilizable                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│                 ReportPage.tsx (91 líneas)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ SOLO COMPOSICIÓN                                  │  │
│  │ • Usa el hook                                        │  │
│  │ • Compone componentes                                │  │
│  │ • Limpio y legible                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌────────────────┐
│ Hierarchical    │ │  TaskInfo    │ │  Statistics    │
│   Selector      │ │  (63 líneas) │ │   Section      │
│  (87 líneas)    │ └──────────────┘ │  (78 líneas)   │
└─────────────────┘                  └────────────────┘
         │                                     │
         └─────────────┬───────────────────────┘
                       ▼
               ┌───────────────┐
               │ SubtasksTable │
               │  (112 líneas) │
               └───────────────┘

         ✅ Componentes pequeños
         ✅ Fáciles de testear
         ✅ Reutilizables
         ✅ Un propósito cada uno
```

---

## 🎨 Ejemplo de Uso de un Componente

### Componente Presentacional Puro

```typescript
// TaskInfo.tsx - SOLO renderización
interface TaskInfoProps {
  task: AsanaTask;
  subtasksCount: number;
}

const TaskInfo: React.FC<TaskInfoProps> = ({ task, subtasksCount }) => {
  // ✅ NO tiene:
  // - useState
  // - useEffect
  // - llamadas a API
  // - lógica de negocio
  
  // ✅ SÍ tiene:
  // - JSX claro
  // - Props bien definidas
  // - Fácil de testear
  
  return (
    <div className="card">
      <h2>Información de la Actividad</h2>
      <div className="task-info">
        <h3>{task.name}</h3>
        {/* ... más JSX ... */}
      </div>
    </div>
  );
};
```

---

## ✨ Resumen

La refactorización transforma un componente monolítico de 493 líneas en:

- **1 Custom Hook** (lógica)
- **1 Container** (composición)
- **4 Componentes Presentacionales** (vista)

**Resultado**:
- ✅ Código más limpio
- ✅ Mejor mantenibilidad
- ✅ Fácil de testear
- ✅ Componentes reutilizables
- ✅ Separación de responsabilidades
