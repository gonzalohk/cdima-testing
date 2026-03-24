import React, { useState } from 'react';
import { Button, Card, Checkbox, Descriptions, Dropdown, Empty, Form, Input, InputNumber, MenuProps, Modal, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, FileWordOutlined, PrinterOutlined, UserAddOutlined } from '@ant-design/icons';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';

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
}) => {
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<AsanaTask | null>(null);
  const [benefModal, setBenefModal] = useState<AsanaTask | null>(null);
  const [hasReplicantes, setHasReplicantes] = useState(false);
  const [benefForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const getFieldGid = (task: AsanaTask, fieldName: string): string | undefined =>
    task.custom_fields?.find(f => f.name === fieldName)?.gid;

  const getEnumOptionGid = (task: AsanaTask, fieldName: string, optionName: string): string | undefined =>
    task.custom_fields?.find(f => f.name === fieldName)?.enum_options?.find(o => o.name.toLowerCase() === optionName.toLowerCase())?.gid;

  const getNumericValue = (task: AsanaTask, fieldName: string): number =>
    task.custom_fields?.find(f => f.name === fieldName)?.number_value ?? 0;

  const handleStatusChange = async (task: AsanaTask, newStatus: 'Ejecutado' | 'En Proceso') => {
    const fieldGid = getFieldGid(task, 'Estado');
    const optionGid = getEnumOptionGid(task, 'Estado', newStatus);
    if (!fieldGid || !optionGid) return;
    setUpdatingStatus(task.gid);
    try {
      const updated = await asanaService.updateTask(task.gid, {
        custom_fields: { [fieldGid]: optionGid },
      });
      onTaskUpdate?.(updated);
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
    return tipoSolicitud === '-' && !isFuentesVerificacion;
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
      width: 220,
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
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 120,
      render: (value: string) => {
        const normalized = value?.toUpperCase?.() || '';
        if (normalized === 'EJECUTADO') return <Tag color="success">Completada</Tag>;
        if (normalized === 'EN PROCESO') return <Tag color="processing">En Proceso</Tag>;
        return <Tag color="default">Pendiente</Tag>;
      },
    },
    {
      title: 'Responsable',
      dataIndex: 'responsable',
      key: 'responsable',
      width: 180,
      render: (value: string) => <Typography.Text>{value || '-'}</Typography.Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: { task: AsanaTask }) => {
        const task = record.task;
        const statusMenuItems: MenuProps['items'] = [
          {
            key: 'ejecutado',
            icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
            label: 'Ejecutado',
            onClick: () => handleStatusChange(task, 'Ejecutado'),
          },
          {
            key: 'en-proceso',
            icon: <ClockCircleOutlined style={{ color: '#0ea5e9' }} />,
            label: 'En Proceso',
            onClick: () => handleStatusChange(task, 'En Proceso'),
          },
        ];
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
            <Dropdown menu={{ items: statusMenuItems }} trigger={['click']} placement="bottomRight">
              <Tooltip title="Cambiar estado">
                <Button
                  size="small"
                  icon={<ClockCircleOutlined />}
                  loading={updatingStatus === task.gid}
                  style={{ fontSize: 13 }}
                />
              </Tooltip>
            </Dropdown>
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
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#1677ff' }} />
            <span>Detalle de Sub Actividad</span>
          </Space>
        }
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={<Button onClick={() => setDetailModal(null)}>Cerrar</Button>}
        width={680}
        destroyOnClose
      >
        {detailModal && (() => {
          const estado = getCustomFieldValue(detailModal, 'Estado');
          const estadoUpper = estado.toUpperCase();
          const estadoTag = estadoUpper === 'EJECUTADO'
            ? <Tag color="success">Ejecutado</Tag>
            : estadoUpper === 'EN PROCESO'
            ? <Tag color="processing">En Proceso</Tag>
            : <Tag color="default">Pendiente</Tag>;

          const hombres    = getCustomFieldValue(detailModal, 'Hombres');
          const mujeres    = getCustomFieldValue(detailModal, 'Mujeres ');
          const replicantes = getCustomFieldValue(detailModal, 'Replicantes');
          const poblacion  = getCustomFieldValue(detailModal, 'Población Meta');
          const lugar      = getCustomFieldValue(detailModal, 'Lugar');
          const responsable = getCustomFieldValue(detailModal, 'Responsable de Actividad');
          const responsables = getCustomFieldValue(detailModal, 'Responsables de actividad');
          const tipo       = getCustomFieldValue(detailModal, 'Tipo');
          const area       = getCustomFieldValue(detailModal, 'Area');

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
              {/* Bloque principal */}
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Nombre">
                  <Typography.Text strong>{detailModal.name}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Estado">{estadoTag}</Descriptions.Item>
                {detailModal.start_on && (
                  <Descriptions.Item label="Fecha de inicio">{detailModal.start_on}</Descriptions.Item>
                )}
                {detailModal.due_on && (
                  <Descriptions.Item label="Fecha de finalización">{detailModal.due_on}</Descriptions.Item>
                )}
                {lugar !== '-' && (
                  <Descriptions.Item label="Lugar">{lugar}</Descriptions.Item>
                )}
                {area !== '-' && (
                  <Descriptions.Item label="Área">{area}</Descriptions.Item>
                )}
                {tipo !== '-' && (
                  <Descriptions.Item label="Tipo">{tipo}</Descriptions.Item>
                )}
                {(responsable !== '-' || responsables !== '-') && (
                  <Descriptions.Item label="Responsable">
                    {responsable !== '-' ? responsable : responsables}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* Beneficiarios */}
              {(poblacion !== '-' || hombres !== '-' || mujeres !== '-' || replicantes !== '-') && (
                <div>
                  <Typography.Text strong style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 8 }}>
                    Beneficiarios
                  </Typography.Text>
                  <Descriptions bordered size="small" column={2}>
                    {poblacion !== '-' && (
                      <Descriptions.Item label="Población Meta" span={2}>
                        <Tag color="blue">{poblacion}</Tag>
                      </Descriptions.Item>
                    )}
                    {hombres !== '-' && (
                      <Descriptions.Item label="Varones">
                        <Tag color="geekblue">{hombres}</Tag>
                      </Descriptions.Item>
                    )}
                    {mujeres !== '-' && (
                      <Descriptions.Item label="Mujeres">
                        <Tag color="magenta">{mujeres}</Tag>
                      </Descriptions.Item>
                    )}
                    {replicantes !== '-' && replicantes !== '0' && (
                      <Descriptions.Item label="Replicantes" span={2}>
                        <Tag color="purple">{replicantes}</Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}

              {/* Descripción / notas */}
              {detailModal.notes && detailModal.notes.trim() && (
                <div>
                  <Typography.Text strong style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>
                    Descripción
                  </Typography.Text>
                  <div style={{
                    background: '#fafafa', border: '1px solid #f0f0f0',
                    borderRadius: 6, padding: '10px 14px',
                  }}>
                    <Typography.Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {detailModal.notes}
                    </Typography.Text>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Agregar Beneficiarios */}
      <Modal
        title="Agregar Beneficiarios"
        open={!!benefModal}
        onOk={handleBeneficiarioSubmit}
        onCancel={() => { setBenefModal(null); setHasReplicantes(false); }}
        confirmLoading={saving}
        okText="Guardar"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {benefModal?.name}
        </Typography.Text>
        <Form form={benefForm} layout="vertical">
          <Form.Item label="Población Meta" name="poblacionMeta" rules={[{ required: true, message: 'Requerido' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Varones" name="hombres" rules={[{ required: true, message: 'Requerido' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Mujeres" name="mujeres" rules={[{ required: true, message: 'Requerido' }]}>
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
            <Form.Item label="Replicantes" name="replicantes" rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
};

export default SubtasksTable;
