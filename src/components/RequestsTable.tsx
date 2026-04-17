import React, { useState } from 'react';
import { Button, Card, Descriptions, Empty, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, CommentOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF, exportMaterialRequestToPDF, exportMaterialReturnToPDF } from '../services/pdf.service';

interface RequestsTableProps {
  subtasks: AsanaTask[];
  onDeleted?: (taskGid: string) => void;
  projectName?: string;
  parentTaskName?: string;
}

interface FundItem {
  id: number;
  descripcion: string;
  importeBolivianos: string;
}

interface MaterialItem {
  id: number;
  detalle: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
}

const RequestsTable: React.FC<RequestsTableProps> = ({ subtasks, onDeleted, projectName, parentTaskName }) => {
  const [detailModal, setDetailModal] = useState<AsanaTask | null>(null);
  const [observeModal, setObserveModal] = useState<AsanaTask | null>(null);
  const [observeText, setObserveText] = useState('');
  const [observeSaving, setObserveSaving] = useState(false);
  const [approvingGid, setApprovingGid] = useState<string | null>(null);
  // Función auxiliar para obtener el valor de un campo personalizado
  const getCustomFieldValue = (task: AsanaTask, fieldName: string): string => {
    if (!task.custom_fields) return '-';
    const field = task.custom_fields.find(f => f.name === fieldName);
    if (!field) return '-';
    
    // Si tiene display_value, usarlo directamente
    if (field.display_value) return field.display_value;
    
    // Para enum, usar el nombre del valor
    if (field.type === 'enum' && field.enum_value) {
      return field.enum_value.name;
    }
    
    return '-';
  };

  // Extraer la fecha de generación de las notas
  const extractFechaSolicitud = (notes: string | undefined): string => {
    if (!notes) return '-';
    
    // Buscar el patrón "Fecha de solicitud: DD/MM/YYYY, HH:MM"
    const regex = /Fecha de solicitud:\s*(\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2})/;
    const match = notes.match(regex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return '-';
  };

  // Parsear información de solicitud de fondos desde las notas
  const parseFundsRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    // Extraer fecha de inicio
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    
    // Extraer fecha de finalización
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    // Extraer fondos solicitados
    const fondos: FundItem[] = [];
    const fondosSection = notes.match(/FONDOS SOLICITADOS:\s*([\s\S]+?)(?=\n\nTOTAL:|\n\n---)/);
    
    if (fondosSection) {
      const fondosText = fondosSection[1];
      const fondosItems = fondosText.split(/\n\n(?=\d+\.)/);
      
      fondosItems.forEach((item, index) => {
        const descMatch = item.match(/\d+\.\s*(.+)/);
        const importeMatch = item.match(/Importe:\s*Bs\.\s*([\d.]+)/);
        
        if (descMatch) {
          fondos.push({
            id: index + 1,
            descripcion: descMatch[1].trim(),
            importeBolivianos: importeMatch ? importeMatch[1] : '0'
          });
        }
      });
    }
    
    return {
      taskName,
      area,
      lugar,
      fechaInicio,
      fechaFinalizacion,
      fondos
    };
  };

  // Parsear información de solicitud de material desde las notas
  const parseMaterialRequest = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar
    const lugarMatch = notes.match(/•\s*Lugar de entrega:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';
    
    // Extraer fecha de inicio
    const fechaInicioMatch = notes.match(/•\s*Fecha de inicio:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaInicio = fechaInicioMatch ? fechaInicioMatch[1] : '';
    
    // Extraer fecha de finalización
    const fechaFinMatch = notes.match(/•\s*Fecha de finalización:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    const fechaFinalizacion = fechaFinMatch ? fechaFinMatch[1] : '';
    
    // Extraer materiales solicitados
    const materiales: MaterialItem[] = [];
    const materialesSection = notes.match(/MATERIALES SOLICITADOS:\s*([\s\S]+?)(?=\n\n---)/);
    
    if (materialesSection) {
      const materialesText = materialesSection[1];
      const materialesItems = materialesText.split(/\n\n(?=\d+\.)/);
      
      materialesItems.forEach((item, index) => {
        const detalleMatch = item.match(/\d+\.\s*(.+)/);
        const cantidadMatch = item.match(/Cantidad:\s*(.+)/);
        const unidadMatch = item.match(/Unidad:\s*(.+)/);
        const observacionesMatch = item.match(/Observaciones:\s*(.+)/);
        
        if (detalleMatch) {
          materiales.push({
            id: index + 1,
            detalle: detalleMatch[1].trim(),
            cantidad: cantidadMatch ? cantidadMatch[1].trim() : '-',
            unidad: unidadMatch ? unidadMatch[1].trim() : '-',
            observaciones: observacionesMatch ? observacionesMatch[1].trim() : '-'
          });
        }
      });
    }
    
    return {
      taskName,
      area,
      lugar,
      fechaInicio,
      fechaFinalizacion,
      materiales
    };
  };

  // Parsear información de solicitud de devolución desde las notas
  const parseMaterialReturn = (task: AsanaTask) => {
    const notes = task.notes || '';
    
    // Extraer el nombre de la actividad
    const activityMatch = notes.match(/Actividad:\s*(.+)/);
    const taskName = activityMatch ? activityMatch[1].trim() : task.name;
    
    // Extraer área
    const areaMatch = notes.match(/•\s*Área:\s*(.+)/);
    const area = areaMatch ? areaMatch[1].trim() : '';
    
    // Extraer lugar de devolución
    const lugarMatch = notes.match(/•\s*Lugar de devolución:\s*(.+)/);
    const lugar = lugarMatch ? lugarMatch[1].trim() : '';

    // Extraer fecha de devolución
    const fechaDevolucionMatch = notes.match(/•\s*Fecha de devolución:\s*(.+)/);
    const fechaDevolucion = fechaDevolucionMatch ? fechaDevolucionMatch[1].trim() : '-';
    
    // Extraer materiales a devolver
    const materiales: MaterialItem[] = [];
    const materialesSection = notes.match(/MATERIALES A DEVOLVER:\s*([\s\S]+?)(?=\n\n---)/);    
    if (materialesSection) {
      const materialesText = materialesSection[1];
      const materialesItems = materialesText.split(/\n\n(?=\d+\.)/);      
      materialesItems.forEach((item, index) => {
        const detalleMatch = item.match(/\d+\.\s*(.+)/);
        const cantidadMatch = item.match(/Cantidad:\s*(.+)/);
        const unidadMatch = item.match(/Unidad:\s*(.+)/);
        const observacionesMatch = item.match(/Observaciones:\s*(.+)/);
        
        if (detalleMatch) {
          materiales.push({
            id: index + 1,
            detalle: detalleMatch[1].trim(),
            cantidad: cantidadMatch ? cantidadMatch[1].trim() : '-',
            unidad: unidadMatch ? unidadMatch[1].trim() : '-',
            observaciones: observacionesMatch ? observacionesMatch[1].trim() : '-'
          });
        }
      });
    }
    
    return {
      taskName,
      area,
      lugar,
      fechaDevolucion,
      materiales
    };
  };

  // Aprobar solicitud (marca como completada en Asana)
  const handleApprove = async (task: AsanaTask) => {
    setApprovingGid(task.gid);
    try {
      await asanaService.updateTask(task.gid, { completed: true } as Parameters<typeof asanaService.updateTask>[1]);
      onDeleted?.(task.gid); // refrescar lista
    } catch (err) {
      console.error('Error approving task:', err);
    } finally {
      setApprovingGid(null);
    }
  };

  // Guardar observación en las notas de la tarea
  const handleObserveSubmit = async () => {
    if (!observeModal || !observeText.trim()) return;
    setObserveSaving(true);
    try {
      const existing = observeModal.notes || '';
      const updated = existing
        ? `${existing}\n\n--- Observación ---\n${observeText.trim()}`
        : `--- Observación ---\n${observeText.trim()}`;
      await asanaService.updateTask(observeModal.gid, { notes: updated } as Parameters<typeof asanaService.updateTask>[1]);
      setObserveModal(null);
      setObserveText('');
    } catch (err) {
      console.error('Error saving observation:', err);
    } finally {
      setObserveSaving(false);
    }
  };

  // Manejar clic en botón eliminar
  const handleDelete = async (task: AsanaTask) => {
    try {
      await asanaService.deleteTask(task.gid);
      onDeleted?.(task.gid);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Manejar clic en botón imprimir
  const handlePrint = (task: AsanaTask) => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    const fechaGeneracion = extractFechaSolicitud(task.notes);
    
    if (tipoSolicitud === 'Solicitud de Fondos') {
      const data = parseFundsRequest(task);
      exportFundsRequestToPDF({
        ...data,
        projectName,
        parentTaskName,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Material') {
      const data = parseMaterialRequest(task);
      exportMaterialRequestToPDF({
        ...data,
        projectName,
        parentTaskName,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    } else if (tipoSolicitud === 'Solicitud de Devolucion') {
      const data = parseMaterialReturn(task);
      exportMaterialReturnToPDF({
        ...data,
        projectName,
        parentTaskName,
        fechaGeneracion: fechaGeneracion !== '-' ? fechaGeneracion : undefined
      });
    }
  };

  // Filtrar solo solicitudes de Fondos y Devolución
  const solicitudes = subtasks.filter(task => {
    const tipoSolicitud = getCustomFieldValue(task, 'Tipo de Solicitud');
    return tipoSolicitud === 'Solicitud de Fondos' || tipoSolicitud === 'Solicitud de Devolucion';
  });

  const tipoTagColor = (tipo: string) => {
    if (tipo === 'Solicitud de Fondos') return 'default';
    if (tipo === 'Solicitud de Devolucion') return 'purple';
    return 'orange';
  };

  const tipoLabel = (tipo: string) =>
    tipo === 'Solicitud de Devolucion' ? 'Devolución de Material' : tipo;

  const columns = [
    {
      title: 'Nombre de la Solicitud',
      dataIndex: 'nombre',
      key: 'nombre',
      width: 300,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 200,
      render: (value: string) => (
        <Tag color={tipoTagColor(value)}>{tipoLabel(value)}</Tag>
      ),
    },
    {
      title: 'Fecha de Generación',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 180,
    },
    {
      title: 'Estado',
      dataIndex: 'finalizada',
      key: 'finalizada',
      width: 130,
      render: (value: boolean) =>
        value
          ? <Tag color="success">Finalizada</Tag>
          : <Tag color="warning">Pendiente</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: { task: AsanaTask }) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailModal(record.task)}
            />
          </Tooltip>
          <Tooltip title="Exportar PDF">
            <Button
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record.task)}
            />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar solicitud?"
            description="Esta acción no se puede deshacer."
            onConfirm={() => handleDelete(record.task)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Eliminar">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
    {
      title: 'Aprobación',
      key: 'aprobar',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: { task: AsanaTask }) => (
        <Space size={4}>
          <Popconfirm
            title="¿Aprobar solicitud?"
            description="Se marcará esta solicitud como aprobada."
            onConfirm={() => handleApprove(record.task)}
            okText="Aprobar"
            cancelText="Cancelar"
            okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
          >
            <Tooltip title="Aprobar solicitud">
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#16a34a', borderColor: '#16a34a' }}
                loading={approvingGid === record.task.gid}
              >
                Aprobar
              </Button>
            </Tooltip>
          </Popconfirm>
          <Tooltip title="Agregar observación">
            <Button
              size="small"
              icon={<CommentOutlined />}
              style={{ color: '#b45309', borderColor: '#d97706' }}
              onClick={() => { setObserveModal(record.task); setObserveText(''); }}
            >
              Observar
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rows = solicitudes.map((task) => ({
    key: task.gid,
    task,
    nombre: task.name,
    tipo: getCustomFieldValue(task, 'Tipo de Solicitud'),
    fecha: extractFechaSolicitud(task.notes),
    finalizada: task.completed,
  }));

  return (
    <>
    <Card className="section-card" bodyStyle={{ padding: 0 }} style={{ marginBottom: '1.5rem' }}>
      <div className="section-card__header">
        <Typography.Title level={4} className="section-card__title">
          Solicitudes ({solicitudes.length})
        </Typography.Title>
      </div>
      <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
        {solicitudes.length === 0 ? (
          <Empty description="No hay solicitudes" />
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

    {/* Modal: Ver Detalle */}
    <Modal
      title={
        <Space>
          <EyeOutlined style={{ color: '#1677ff' }} />
          <span>Detalle de Solicitud</span>
        </Space>
      }
      open={!!detailModal}
      onCancel={() => setDetailModal(null)}
      footer={[
        <Button key="close" onClick={() => setDetailModal(null)}>Cerrar</Button>,
        <Button key="print" icon={<PrinterOutlined />} type="primary" onClick={() => { if (detailModal) handlePrint(detailModal); }}>
          Exportar PDF
        </Button>,
      ]}
      width={600}
    >
      {detailModal && (() => {
        const tipo = getCustomFieldValue(detailModal, 'Tipo de Solicitud');
        const fecha = extractFechaSolicitud(detailModal.notes);
        let parsed: Record<string, string> = {};
        if (tipo === 'Solicitud de Fondos') {
          const d = parseFundsRequest(detailModal);
          parsed = { Actividad: d.taskName, Área: d.area, 'Lugar de entrega': d.lugar, 'Fecha inicio': d.fechaInicio, 'Fecha finalización': d.fechaFinalizacion };
        } else if (tipo === 'Solicitud de Material') {
          const d = parseMaterialRequest(detailModal);
          parsed = { Actividad: d.taskName, Área: d.area, 'Lugar de entrega': d.lugar, 'Fecha inicio': d.fechaInicio, 'Fecha finalización': d.fechaFinalizacion };
        } else if (tipo === 'Solicitud de Devolucion') {
          const d = parseMaterialReturn(detailModal);
          parsed = { Actividad: d.taskName, Área: d.area, 'Lugar de devolución': d.lugar, 'Fecha de devolución': d.fechaDevolucion };
        }
        return (
          <Descriptions bordered size="small" column={1} style={{ marginTop: 8 }}>
            <Descriptions.Item label="Tipo">
              <Tag color={tipoTagColor(tipo)}>{tipoLabel(tipo)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Fecha de generación">{fecha}</Descriptions.Item>
            <Descriptions.Item label="Estado">
              {detailModal.completed
                ? <Tag color="success">Aprobada</Tag>
                : <Tag color="warning">Pendiente</Tag>}
            </Descriptions.Item>
            {Object.entries(parsed).filter(([, v]) => v).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>{v}</Descriptions.Item>
            ))}
            {detailModal.notes && (
              <Descriptions.Item label="Notas">
                <Typography.Text style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {detailModal.notes}
                </Typography.Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        );
      })()}
    </Modal>

    {/* Modal: Observar Solicitud */}
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#b45309' }} />
          <span>Observar Solicitud</span>
        </Space>
      }
      open={!!observeModal}
      onOk={handleObserveSubmit}
      onCancel={() => { setObserveModal(null); setObserveText(''); }}
      confirmLoading={observeSaving}
      okText="Guardar observación"
      cancelText="Cancelar"
      okButtonProps={{ style: { background: '#b45309', borderColor: '#b45309' } }}
      destroyOnClose
    >
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {observeModal?.name}
      </Typography.Text>
      <Form layout="vertical">
        <Form.Item label="Observación" required>
          <Input.TextArea
            rows={4}
            placeholder="Escribe la observación sobre esta solicitud..."
            value={observeText}
            onChange={e => setObserveText(e.target.value)}
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
    </>
  );
};

export default RequestsTable;
