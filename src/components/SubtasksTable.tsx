import React, { useState } from 'react';
import { Button, Card, Checkbox, Empty, Form, Input, InputNumber, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined, FileWordOutlined, PrinterOutlined, UserAddOutlined } from '@ant-design/icons';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { useAuth } from '../context/AuthContext';
import { HtmlModalHeader } from './ModalShared';

interface SubtasksTableProps {
  filteredSubtasks: AsanaTask[];
  uniqueLugares: string[];
  uniqueResponsables: string[];
  searchTerm: string;
  statusFilter: string;
  lugarFilter: string;
  responsableFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onLugarFilterChange: (value: string) => void;
  onResponsableFilterChange: (value: string) => void;
  onExportPDF: () => void;
  onExportWord?: () => void;
  onTaskUpdate?: (updatedTask: AsanaTask) => void;
  allSubtasks?: AsanaTask[];
  parentTask?: AsanaTask;
  onParentTaskUpdate?: (updatedTask: AsanaTask) => void;
}

const SubtasksTable: React.FC<SubtasksTableProps> = ({
  filteredSubtasks,
  uniqueLugares,
  uniqueResponsables,
  searchTerm,
  statusFilter,
  lugarFilter,
  responsableFilter,
  onSearchChange,
  onStatusFilterChange,
  onLugarFilterChange,
  onResponsableFilterChange,
  onExportPDF,
  onExportWord,
  onTaskUpdate,
  allSubtasks,
  parentTask,
  onParentTaskUpdate,
}) => {
  const { user } = useAuth();
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<AsanaTask | null>(null);
  const [benefModal, setBenefModal] = useState<AsanaTask | null>(null);
  const [hasReplicantes, setHasReplicantes] = useState(false);
  const [benefForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const getFieldGid = (task: AsanaTask, fieldName: string): string | undefined =>
    task.custom_fields?.find(f => f.name === fieldName)?.gid;

  const getNumericValue = (task: AsanaTask, fieldName: string): number =>
    task.custom_fields?.find(f => f.name === fieldName)?.number_value ?? 0;

  const getEstadoSelectStyle = (estado: string): React.CSSProperties => {
    if (estado === 'EJECUTADO') return { backgroundColor: '#c8f5c8', color: '#166534', border: '1px solid #16a34a', fontWeight: 700 };
    if (estado === 'EN PROGRESO') return { backgroundColor: '#bfdbfe', color: '#1e3a8a', border: '1px solid #2563eb', fontWeight: 700 };
    return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #9ca3af' };
  };

  const decodeLmod = (task: AsanaTask): { user: string; datetime: string } | null => {
    const lmodField = task.custom_fields?.find(f => f.name === 'lmod');
    const encoded = lmodField?.text_value;
    if (!encoded) return null;
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(encoded))) as { user: string; date: string };
      const d = new Date(decoded.date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        user: decoded.user,
        datetime: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      };
    } catch {
      return null;
    }
  };

  const handleStatusChange = async (task: AsanaTask, newStatus: string) => {
    const estadoField = task.custom_fields?.find(f => f.name === 'Estado');
    if (!estadoField?.gid) return;
    const enumOption = estadoField.enum_options?.find(o => o.name === newStatus);
    if (!enumOption?.gid) return;
    setUpdatingStatus(task.gid);
    try {
      const customFields: Record<string, string> = { [estadoField.gid]: enumOption.gid };
      const lmodField = task.custom_fields?.find(f => f.name === 'lmod');
      if (lmodField?.gid && user) {
        const payload = JSON.stringify({ user: user.name, date: new Date().toISOString() });
        customFields[lmodField.gid] = btoa(encodeURIComponent(payload));
      }
      const updated = await asanaService.updateTask(task.gid, { custom_fields: customFields });
      onTaskUpdate?.(updated);

      // Sync parent task status
      if (parentTask) {
        const updatedAll = (allSubtasks ?? []).map(t => t.gid === task.gid ? updated : t);
        const realSubtasks = updatedAll.filter(t => {
          const ts = t.custom_fields?.find(f => f.name === 'Tipo de Solicitud');
          const tsVal = ts?.display_value || ts?.enum_value?.name || (ts?.text_value ?? '-');
          return (tsVal === '-' || !tsVal) && !t.name.startsWith('FUENTES DE VERIFICACION') && !t.name.startsWith('Resumen:');
        });
        const parentEstadoField = parentTask.custom_fields?.find(f => f.name === 'Estado');
        if (parentEstadoField?.gid) {
          const allExecuted = realSubtasks.length > 0 && realSubtasks.every(t => {
            const ef = t.custom_fields?.find(f => f.name === 'Estado');
            const val = ef?.display_value || ef?.enum_value?.name || '';
            return val === 'EJECUTADO';
          });
          let newParentStatus: string | null = null;
          if (allExecuted) newParentStatus = 'EJECUTADO';
          else if (newStatus === 'EN PROCESO') newParentStatus = 'EN PROCESO';
          if (newParentStatus) {
            const parentEnumOption = parentEstadoField.enum_options?.find(o => o.name === newParentStatus);
            if (parentEnumOption?.gid) {
              const parentCF: Record<string, string> = { [parentEstadoField.gid]: parentEnumOption.gid };
              const parentLmodField = parentTask.custom_fields?.find(f => f.name === 'lmod');
              if (parentLmodField?.gid && user) {
                const payload = JSON.stringify({ user: user.name, date: new Date().toISOString() });
                parentCF[parentLmodField.gid] = btoa(encodeURIComponent(payload));
              }
              const updatedParent = await asanaService.updateTask(parentTask.gid, { custom_fields: parentCF });
              onParentTaskUpdate?.(updatedParent);
            }
          }
        }
      }
    } catch (err) {
      alert('Error al actualizar el estado.');
      console.error(err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openBenefModal = (task: AsanaTask) => {
    const existingReplicantes = getNumericValue(task, 'Replicantes');
    const hasR = existingReplicantes > 0;
    setHasReplicantes(hasR);
    benefForm.setFieldsValue({
      poblacionMeta: getNumericValue(task, 'Población Meta'),
      hombres: getNumericValue(task, 'Hombres'),
      mujeres: getNumericValue(task, 'Mujeres '),
      replicantes: existingReplicantes,
      tieneReplicantes: hasR,
    });
    setBenefModal(task);
  };

  const handleBeneficiarioSubmit = async () => {
    if (!benefModal) return;
    const values = await benefForm.validateFields();
    setSaving(true);
    try {
      const cf: Record<string, number> = {};
      const pmGid = getFieldGid(benefModal, 'Población Meta');
      const hGid  = getFieldGid(benefModal, 'Hombres');
      const mGid  = getFieldGid(benefModal, 'Mujeres ');
      const rGid  = getFieldGid(benefModal, 'Replicantes');
      if (pmGid) cf[pmGid] = values.poblacionMeta ?? 0;
      if (hGid)  cf[hGid]  = values.hombres ?? 0;
      if (mGid)  cf[mGid]  = values.mujeres ?? 0;
      if (hasReplicantes && rGid) cf[rGid] = values.replicantes ?? 0;
      const updated = await asanaService.updateTask(benefModal.gid, { custom_fields: cf });
      onTaskUpdate?.(updated);
      setBenefModal(null);
    } finally {
      setSaving(false);
    }
  };
  // Función auxiliar para obtener el valor de un campo personalizado
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para multi_enum, concatenar los valores
    if (field.type === 'multi_enum' && field.multi_enum_values && field.multi_enum_values.length > 0) {
      return field.multi_enum_values.map(v => v.name).join(', ');
    }
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    // Para number
    if (field.type === 'number' && field.number_value !== null && field.number_value !== undefined) {
      return field.number_value.toString();
    }
    
    // Para text
    if (field.type === 'text' && field.text_value) {
      return field.text_value;
    }
    
    return '-';
  };

  // Filtrar las subtareas que NO tienen "Tipo de Solicitud" y que NO son FUENTES DE VERIFICACION
  const subtasksWithoutRequests = filteredSubtasks.filter(task => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    const isFuentesVerificacion = task.name.startsWith('FUENTES DE VERIFICACION');
    return tipoSolicitud === '-' && !isFuentesVerificacion && !task.name.startsWith('Resumen:');
  });

  const rows = subtasksWithoutRequests.map((task) => ({
    key: task.gid,
    task,
    nombre: task.name,
    descripcion: task.notes || '-',
    fecha: [task.start_on, task.due_on].filter(Boolean).join(' – ') || 'Sin fecha',
    lugar: getCustomFieldValue(task, 'Lugar'),
    estado: getCustomFieldValue(task, 'Estado'),
    poblacionMeta: getCustomFieldValue(task, 'Población Meta'),
    responsable: getCustomFieldValue(task, 'Responsable de Actividad'),
  }));

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 300,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 180,
    },
    {
      title: 'Lugar',
      dataIndex: 'lugar',
      key: 'lugar',
      width: 140,
      render: (value: string) => <Typography.Text>{value || '-'}</Typography.Text>,
    },
    {
      title: 'Responsable',
      dataIndex: 'responsable',
      key: 'responsable',
      width: 130,
      render: (value: string) => <Typography.Text>{value || '-'}</Typography.Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, record: { task: AsanaTask }) => {
        const task = record.task;
        return (
          <Space size={4}>
            <Tooltip title="Ver detalles">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setDetailModal(task)}
                style={{ fontSize: 13 }}
              />
            </Tooltip>
            <Tooltip title="Agregar beneficiarios">
              <Button
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => openBenefModal(task)}
                style={{ fontSize: 13 }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 150,
      render: (_: string, record: { task: AsanaTask; estado: string }) => {
        const task = record.task;
        const estadoActual = record.estado;
        const opciones = task.custom_fields?.find(f => f.name === 'Estado')?.enum_options ?? [];
        const lmodInfo = decodeLmod(task);
        if (updatingStatus === task.gid) {
          return <span style={{ fontSize: '0.8rem', color: '#999' }}>Actualizando...</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <select
              value={estadoActual}
              onChange={e => handleStatusChange(task, e.target.value)}
              style={{
                padding: '0.375rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.813rem',
                cursor: 'pointer',
                outline: 'none',
                width: '100%',
                ...getEstadoSelectStyle(estadoActual),
              }}
            >
              {opciones.length === 0 && <option value={estadoActual}>{estadoActual}</option>}
              {opciones.map(opt => (
                <option key={opt.gid} value={opt.name}>{opt.name}</option>
              ))}
            </select>
            {lmodInfo && (
              <div style={{ fontSize: '0.65rem', color: '#bbb', lineHeight: 1.4, textAlign: 'center' }}>
                <div>{lmodInfo.user}</div>
                <div>{lmodInfo.datetime}</div>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'completed', label: 'Completadas' },
    { value: 'pending', label: 'Pendientes' },
  ];

  const lugarOptions = [
    { value: 'all', label: 'Todos los lugares' },
    ...uniqueLugares.map((lugar) => ({ value: lugar, label: lugar })),
  ];

  const responsableOptions = [
    { value: 'all', label: 'Todos los responsables' },
    ...uniqueResponsables.map((responsable) => ({ value: responsable, label: responsable })),
  ];

  return (
    <>
    <Card className="section-card" bodyStyle={{ padding: 0 }} style={{ marginBottom: '1.5rem' }}>
      <div className="section-card__header">
        <Typography.Title level={4} className="section-card__title">
          Sub Actividades ({subtasksWithoutRequests.length})
        </Typography.Title>
        <Space size={8}>
          {onExportWord && (
            <Tooltip title="Exportar a Word">
              <Button className="task-ficha-pro__actions-trigger" onClick={onExportWord} icon={<FileWordOutlined />} />
            </Tooltip>
          )}
          <Tooltip title="Exportar a PDF">
            <Button className="task-ficha-pro__actions-trigger" onClick={onExportPDF} icon={<PrinterOutlined />} />
          </Tooltip>
        </Space>
      </div>

      <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
        <Space wrap size={10} style={{ marginBottom: 16, width: '100%' }}>
          <Input.Search
            placeholder="Buscar por nombre..."
            allowClear
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <Select
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={statusOptions}
            style={{ minWidth: 180 }}
          />
          <Select
            value={lugarFilter}
            onChange={onLugarFilterChange}
            options={lugarOptions}
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 200 }}
          />
          <Select
            value={responsableFilter}
            onChange={onResponsableFilterChange}
            options={responsableOptions}
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220 }}
          />
        </Space>

        {subtasksWithoutRequests.length === 0 ? (
          <Empty description="No se encontraron sub actividades" />
        ) : (
          <Table
            columns={columns}
            dataSource={rows}
            size="middle"
            bordered
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowClassName={(_, index) => index % 2 !== 0 ? 'ant-table-row-stripe' : ''}
          />
        )}
      </div>
    </Card>

      {/* Modal: Ver Detalles */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)} style={{ zIndex: 1001 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <HtmlModalHeader icon="🔍" title="Detalle de Sub Actividad" subtitle={detailModal.name} onClose={() => setDetailModal(null)} />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const estado = getCustomFieldValue(detailModal, 'Estado');
                const estadoUpper = estado.toUpperCase();
                const estadoTag = estadoUpper === 'EJECUTADO'
                  ? <Tag color="success">Ejecutado</Tag>
                  : estadoUpper === 'EN PROCESO'
                  ? <Tag color="processing">En Proceso</Tag>
                  : <Tag color="default">Pendiente</Tag>;

                const hombres     = getCustomFieldValue(detailModal, 'Hombres');
                const mujeres     = getCustomFieldValue(detailModal, 'Mujeres ');
                const replicantes = getCustomFieldValue(detailModal, 'Replicantes');
                const poblacion   = getCustomFieldValue(detailModal, 'Población Meta');
                const lugar       = getCustomFieldValue(detailModal, 'Lugar');
                const responsable = getCustomFieldValue(detailModal, 'Responsable de Actividad');
                const responsables = getCustomFieldValue(detailModal, 'Responsables de actividad');
                const tipo        = getCustomFieldValue(detailModal, 'Tipo');
                const area        = getCustomFieldValue(detailModal, 'Area');

                return (
                  <>
                    {/* Info general */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</span>
                        <div style={{ marginTop: '0.15rem' }}>{estadoTag}</div>
                      </div>
                      {detailModal.start_on && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de inicio</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{detailModal.start_on}</p>
                        </div>
                      )}
                      {detailModal.due_on && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha de finalización</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{detailModal.due_on}</p>
                        </div>
                      )}
                      {lugar !== '-' && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lugar</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{lugar}</p>
                        </div>
                      )}
                      {area !== '-' && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Área</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{area}</p>
                        </div>
                      )}
                      {tipo !== '-' && (
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{tipo}</p>
                        </div>
                      )}
                      {(responsable !== '-' || responsables !== '-') && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsable</span>
                          <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#333' }}>{responsable !== '-' ? responsable : responsables}</p>
                        </div>
                      )}
                    </div>

                    {/* Beneficiarios */}
                    {(poblacion !== '-' || hombres !== '-' || mujeres !== '-' || replicantes !== '-') && (
                      <div>
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Beneficiarios</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                          {poblacion !== '-' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Población Meta</span>
                              <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#1d4ed8', fontWeight: 600 }}>{poblacion}</p>
                            </div>
                          )}
                          {hombres !== '-' && (
                            <div>
                              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Varones</span>
                              <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#1e40af', fontWeight: 600 }}>{hombres}</p>
                            </div>
                          )}
                          {mujeres !== '-' && (
                            <div>
                              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mujeres</span>
                              <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#be185d', fontWeight: 600 }}>{mujeres}</p>
                            </div>
                          )}
                          {replicantes !== '-' && replicantes !== '0' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Replicantes</span>
                              <p style={{ margin: '0.1rem 0 0', fontSize: '0.875rem', color: '#6b21a8', fontWeight: 600 }}>{replicantes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notas */}
                    {detailModal.notes && detailModal.notes.trim() && (
                      <div>
                        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descripción</p>
                        <div style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '0.75rem 1rem' }}>
                          <Typography.Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{detailModal.notes}</Typography.Text>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa' }}>
              <button type="button" className="button-primary" onClick={() => setDetailModal(null)} style={{ width: '100%' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar Beneficiarios */}
      {benefModal && (
        <div className="modal-overlay" onClick={() => { setBenefModal(null); setHasReplicantes(false); }} style={{ zIndex: 1001 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0 }}>
            <HtmlModalHeader icon="👥" title="Agregar Beneficiarios" subtitle={benefModal.name} onClose={() => { setBenefModal(null); setHasReplicantes(false); }} />
            <div className="modal-body" style={{ padding: '1.5rem 1.75rem' }}>
              <Form form={benefForm} layout="vertical">
                <Form.Item label={<strong>Población Meta</strong>} name="poblacionMeta" rules={[{ required: true, message: 'Requerido' }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={<strong>Varones</strong>} name="hombres" rules={[{ required: true, message: 'Requerido' }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label={<strong>Mujeres</strong>} name="mujeres" rules={[{ required: true, message: 'Requerido' }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="tieneReplicantes" valuePropName="checked" style={{ marginBottom: hasReplicantes ? 0 : undefined }}>
                  <Checkbox
                    onChange={(e) => {
                      setHasReplicantes(e.target.checked);
                      if (!e.target.checked) benefForm.setFieldValue('replicantes', 0);
                    }}
                  >
                    Tiene replicantes
                  </Checkbox>
                </Form.Item>
                {hasReplicantes && (
                  <Form.Item label={<strong>Replicantes</strong>} name="replicantes" rules={[{ required: true, message: 'Requerido' }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                )}
              </Form>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                style={{ border: '1px solid #d9d9d9', background: '#fff', padding: '0.5rem 1.25rem', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => { setBenefModal(null); setHasReplicantes(false); }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleBeneficiarioSubmit}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SubtasksTable;
