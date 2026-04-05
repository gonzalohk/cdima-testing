import React, { useMemo } from 'react';
import { Card, Tag, Tooltip, Typography, Space } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { AsanaTask } from '../types/asana.types';
import {
  parseISO,
  differenceInDays,
  startOfMonth,
  addMonths,
  format,
  isBefore,
  min as dateMin,
  max as dateMax,
} from 'date-fns';
import { es } from 'date-fns/locale';

interface GanttChartProps {
  task: AsanaTask;
  subtasks: AsanaTask[];
}

type StatusKey = 'Ejecutado' | 'En Proceso' | 'Pendiente';

const STATUS_CONFIG: Record<StatusKey | 'default', {
  bar: string;
  barEnd: string;
  shadow: string;
  antd: 'success' | 'processing' | 'warning' | 'default';
  label: string;
}> = {
  'Ejecutado':  { bar: '#16a34a', barEnd: '#22c55e', shadow: '#16a34a40', antd: 'success', label: 'Ejecutado' },
  'En Proceso': { bar: '#1d4ed8', barEnd: '#3b82f6', shadow: '#1d4ed840', antd: 'processing', label: 'En Proceso' },
  'Pendiente':  { bar: '#b45309', barEnd: '#f59e0b', shadow: '#b4530940', antd: 'warning', label: 'Pendiente' },
  'default':    { bar: '#9ca3af', barEnd: '#d1d5db', shadow: '#9ca3af30', antd: 'default', label: 'Sin estado' },
};

const NAME_COL = 400;
const HEADER_H = 46;
const ROW_MAIN = 54;
const ROW_SUB = 44;
const BAR_MAIN = 28;
const BAR_SUB = 20;

// ─── helpers ──────────────────────────────────────────────────────────────────

function getCustomFieldValue(task: AsanaTask, fieldName: string): string {
  if (!task.custom_fields) return '-';
  const field = task.custom_fields.find(f => f.name === fieldName);
  if (!field) return '-';
  if (field.display_value) return field.display_value;
  if (field.type === 'multi_enum' && field.multi_enum_values?.length)
    return field.multi_enum_values.map(v => v.name).join(', ');
  if (field.type === 'enum' && field.enum_value) return field.enum_value.name;
  if (field.type === 'number' && field.number_value != null) return field.number_value.toString();
  if (field.type === 'text' && field.text_value) return field.text_value;
  return '-';
}

function getStatusConfig(task: AsanaTask) {
  const s = getCustomFieldValue(task, 'Estado') as StatusKey;
  return STATUS_CONFIG[s] ?? STATUS_CONFIG.default;
}

function barPosition(task: AsanaTask, rangeStart: Date, totalDays: number) {
  if (!task.start_on && !task.due_on) return null;
  const s = task.start_on ? parseISO(task.start_on) : parseISO(task.due_on!);
  const e = task.due_on   ? parseISO(task.due_on)   : parseISO(task.start_on!);
  const leftDays = Math.max(0, differenceInDays(s, rangeStart));
  const dur = Math.max(1, differenceInDays(e, s) + 1);
  const left = (leftDays / totalDays) * 100;
  const width = Math.min((dur / totalDays) * 100, 100 - left);
  return { left, width, durationDays: differenceInDays(e, s) + 1 };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function GridLines({ months, rangeStart, totalDays, striped }: {
  months: Date[];
  rangeStart: Date;
  totalDays: number;
  striped?: boolean;
}) {
  return (
    <>
      {months.map(m => {
        const left = (differenceInDays(m, rangeStart) / totalDays) * 100;
        return (
          <div
            key={m.toISOString()}
            style={{
              position: 'absolute',
              top: 0, bottom: 0,
              left: `${left}%`,
              width: 1,
              background: striped ? '#e5e7eb' : '#f0f0f0',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
}

function GanttBar({ task, h, rangeStart, totalDays, isMain }: {
  task: AsanaTask;
  h: number;
  barH: number;
  rangeStart: Date;
  totalDays: number;
  isMain?: boolean;
}) {
  const barH = isMain ? BAR_MAIN : BAR_SUB;
  const cfg = getStatusConfig(task);
  const pos = barPosition(task, rangeStart, totalDays);

  if (!pos) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
      }}>
        <Typography.Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
          Sin fechas definidas
        </Typography.Text>
      </div>
    );
  }

  const label = pos.durationDays > 1 ? `${pos.durationDays} días` : '1 día';
  const showLabel = pos.width > 6;

  return (
    <Tooltip
      title={
        <span style={{ fontSize: 12 }}>
          {task.name}<br />
          {task.start_on || '?'} → {task.due_on || '?'}
          {' '}({label})
        </span>
      }
    >
      <div
        style={{
          position: 'absolute',
          top: (h - barH) / 2,
          left: `${pos.left}%`,
          width: `${pos.width}%`,
          minWidth: 6,
          height: barH,
          background: `linear-gradient(90deg, ${cfg.bar}, ${cfg.barEnd})`,
          borderRadius: isMain ? 6 : 4,
          boxShadow: `0 2px 8px ${cfg.shadow}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 8,
          overflow: 'hidden',
          cursor: 'default',
          transition: 'opacity .15s',
        }}
      >
        {showLabel && (
          <span style={{
            fontSize: isMain ? 11 : 10,
            color: '#fff',
            fontWeight: isMain ? 700 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const GanttChart: React.FC<GanttChartProps> = ({ task, subtasks }) => {

  // Filter subtasks: exclude requests, fund/material/return/hiring tasks and verification sources
  const ganttSubtasks = useMemo(() => subtasks.filter(t => {
    const tipo = getCustomFieldValue(t, 'Tipo de Solicitud');
    if (tipo !== '-') return false; // exclude any task with a Tipo de Solicitud value set
    const name = t.name.trim().toUpperCase();
    if (name.startsWith('FUENTES DE VERIFICACION')
      || name.startsWith('SFON')
      || name.startsWith('SMAT')
      || name.startsWith('DMAT')
      || name.startsWith('CPER')
      || name.startsWith('RESUMEN:')) return false;
    const estado = getCustomFieldValue(t, 'Estado');
    return estado === 'EJECUTADO' || estado === 'EN PROCESO';
  }), [subtasks]);

  const allTasks = useMemo(() => [task, ...ganttSubtasks], [task, ganttSubtasks]);

  // Date range
  const { rangeStart, rangeEnd, totalDays, months } = useMemo(() => {
    const dates = allTasks
      .flatMap(t => [
        t.start_on ? parseISO(t.start_on) : null,
        t.due_on   ? parseISO(t.due_on)   : null,
      ])
      .filter((d): d is Date => d !== null);

    let rStart: Date, rEnd: Date;
    if (dates.length === 0) {
      rStart = startOfMonth(new Date());
      rEnd   = addMonths(rStart, 3);
    } else {
      rStart = startOfMonth(dateMin(dates));
      rEnd   = addMonths(startOfMonth(dateMax(dates)), 1);
    }

    const td = differenceInDays(rEnd, rStart) || 1;
    const ms: Date[] = [];
    let cur = new Date(rStart);
    while (isBefore(cur, rEnd)) {
      ms.push(new Date(cur));
      cur = addMonths(cur, 1);
    }
    return { rangeStart: rStart, rangeEnd: rEnd, totalDays: td, months: ms };
  }, [allTasks]);

  // Today marker
  const todayPct = useMemo(() => {
    const today = new Date();
    if (!isBefore(rangeStart, today) || isBefore(rangeEnd, today)) return null;
    return (differenceInDays(today, rangeStart) / totalDays) * 100;
  }, [rangeStart, rangeEnd, totalDays]);

  const totalRows = 1 + ganttSubtasks.length;
  const bodyHeight = HEADER_H + ROW_MAIN + ganttSubtasks.length * ROW_SUB;

  return (
    <Card
      title={
        <Space size="small">
          <CalendarOutlined style={{ color: '#1677ff', fontSize: 17 }} />
          <Typography.Text strong style={{ fontSize: 15 }}>Cronograma de Actividades</Typography.Text>
          <Tag color="blue" style={{ marginLeft: 4 }}>
            {totalRows} {totalRows === 1 ? 'actividad' : 'actividades'}
          </Tag>
        </Space>
      }
      extra={
        <Space wrap size={[12, 4]}>
          {(Object.keys(STATUS_CONFIG) as (StatusKey | 'default')[])
            .filter(k => k !== 'default' && k !== 'Pendiente')
            .map(k => {
              const cfg = STATUS_CONFIG[k];
              return (
                <Space key={k} size={5}>
                  <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${cfg.bar}, ${cfg.barEnd})`,
                  }} />
                  <Typography.Text style={{ fontSize: 12 }}>{cfg.label}</Typography.Text>
                </Space>
              );
            })}
          <Space size={5}>
            <span style={{ display: 'inline-block', width: 2, height: 14, background: '#ef4444', borderRadius: 1 }} />
            <Typography.Text style={{ fontSize: 12 }}>Hoy</Typography.Text>
          </Space>
        </Space>
      }
      style={{ marginBottom: '1.5rem', borderRadius: 8 }}
      styles={{ body: { padding: 0, overflow: 'hidden' } }}
    >
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{
          display: 'flex',
          width: '100%',
          minHeight: bodyHeight,
        }}>

          {/* ── Name column (fixed) ─────────────────────────────────── */}
          <div style={{
            width: NAME_COL,
            flexShrink: 0,
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            left: 0,
            zIndex: 4,
            background: '#ffffff',
          }}>

            {/* Column header */}
            <div style={{
              height: HEADER_H,
              background: '#fafafa',
              borderBottom: '2px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
            }}>
              <Typography.Text type="secondary" style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Actividad
              </Typography.Text>
            </div>

            {/* Main task name cell */}
            <Tooltip title={task.name} placement="topLeft">
              <div style={{
                height: ROW_MAIN,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
                background: '#eff6ff',
                borderBottom: '1px solid #dbeafe',
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getStatusConfig(task).bar,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1e3a5f',
                  }}>
                    {task.name}
                  </div>
                </div>
              </div>
            </Tooltip>

            {/* Subtask name cells */}
            {ganttSubtasks.map((t, idx) => (
              <Tooltip key={t.gid} title={t.name} placement="topLeft">
                <div style={{
                  height: ROW_SUB,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px 0 22px',
                  gap: 7,
                  background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderBottom: '1px solid #f3f4f6',
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: getStatusConfig(t).bar,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                      color: '#374151',
                    }}>
                      {t.name}
                    </div>
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>

          {/* ── Timeline column ────────────────────────────────────── */}
          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>

            {/* Month header row */}
            <div style={{
              height: HEADER_H,
              display: 'flex',
              background: '#fafafa',
              borderBottom: '2px solid #e5e7eb',
              position: 'relative',
              zIndex: 1,
            }}>
              {months.map(m => {
                const next = addMonths(m, 1);
                const inRange = Math.max(
                  0,
                  differenceInDays(
                    isBefore(next, rangeEnd) ? next : rangeEnd,
                    isBefore(rangeStart, m)  ? m    : rangeStart,
                  ),
                );
                const widthPct = (inRange / totalDays) * 100;
                return (
                  <div
                    key={m.toISOString()}
                    style={{
                      width: `${widthPct}%`,
                      borderRight: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography.Text style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#4b5563',
                      textTransform: 'capitalize',
                    }}>
                      {format(m, 'MMM yyyy', { locale: es })}
                    </Typography.Text>
                  </div>
                );
              })}
            </div>

            {/* Today line (spans all bar rows) */}
            {todayPct !== null && (
              <div style={{
                position: 'absolute',
                top: HEADER_H,
                bottom: 0,
                left: `${todayPct}%`,
                width: 2,
                background: '#ef4444cc',
                zIndex: 3,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.04em',
                }}>
                  HOY
                </div>
              </div>
            )}

            {/* Main task bar row */}
            <div style={{
              height: ROW_MAIN,
              position: 'relative',
              background: '#eff6ff',
              borderBottom: '1px solid #dbeafe',
            }}>
              <GridLines months={months} rangeStart={rangeStart} totalDays={totalDays} striped />
              <GanttBar
                task={task}
                h={ROW_MAIN}
                barH={BAR_MAIN}
                rangeStart={rangeStart}
                totalDays={totalDays}
                isMain
              />
            </div>

            {/* Subtask bar rows */}
            {ganttSubtasks.map((t, idx) => (
              <div
                key={t.gid}
                style={{
                  height: ROW_SUB,
                  position: 'relative',
                  background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <GridLines months={months} rangeStart={rangeStart} totalDays={totalDays} />
                <GanttBar
                  task={t}
                  h={ROW_SUB}
                  barH={BAR_SUB}
                  rangeStart={rangeStart}
                  totalDays={totalDays}
                />
              </div>
            ))}

            {/* Empty state when all tasks lack dates */}
            {allTasks.every(t => !t.start_on && !t.due_on) && (
              <div style={{
                position: 'absolute',
                top: HEADER_H,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Ninguna actividad tiene fechas definidas
                </Typography.Text>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer: date range summary */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #f0f0f0',
        background: '#fafafa',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <CalendarOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Rango: {format(rangeStart, 'dd MMM yyyy', { locale: es })} — {format(rangeEnd, 'dd MMM yyyy', { locale: es })}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          · {totalDays} días totales · {ganttSubtasks.length} subtarea{ganttSubtasks.length !== 1 ? 's' : ''}
        </Typography.Text>
      </div>
    </Card>
  );
};

export default GanttChart;
