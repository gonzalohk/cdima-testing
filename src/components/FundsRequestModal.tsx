import React, { useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Typography } from 'antd';
import { DeleteOutlined, DollarOutlined, PlusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { SectionHeader, HtmlModalHeader } from './ModalShared';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportFundsRequestToPDF } from '../services/pdf.service';
import Notification from './Notification';
import { useAuth } from '../context/AuthContext';

interface FundItem {
  id: number;
  descripcion: string;
  importeBolivianos: string;
}

interface SfonInitialData {
  titulo?: string;
  area?: string;
  lugar?: string;
  fechaInicio?: string;
  fechaFinalizacion?: string;
  fondos?: { id: number; descripcion: string; importeBolivianos?: string }[];
}

interface FundsRequestModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
  projectName?: string;
  parentTaskName?: string;
  initialData?: SfonInitialData;
}

const FundsRequestModal: React.FC<FundsRequestModalProps> = ({ task, onClose, onSuccess, projectName, initialData }) => {
  const [area, setArea] = useState(initialData?.area ?? '');
  const [titulo, setTitulo] = useState(initialData?.titulo ?? '');
  const [lugar, setLugar] = useState(initialData?.lugar ?? '');
  const [fechaInicio, setFechaInicio] = useState(initialData?.fechaInicio ?? '');
  const [fechaFinalizacion, setFechaFinalizacion] = useState(initialData?.fechaFinalizacion ?? '');
  const [fondos, setFondos] = useState<FundItem[]>(
    initialData?.fondos && initialData.fondos.length > 0
      ? initialData.fondos.map(f => ({ id: f.id, descripcion: f.descripcion, importeBolivianos: f.importeBolivianos ?? '' }))
      : [{ id: 1, descripcion: '', importeBolivianos: '' }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { user } = useAuth();
  const [solicitante, setSolicitante] = useState(user?.solicitante ?? '');
  const [cargo, setCargo] = useState(user?.cargo ?? '');

  const agregarFondo = () => {
    const newId = Math.max(...fondos.map(f => f.id), 0) + 1;
    setFondos([...fondos, { id: newId, descripcion: '', importeBolivianos: '' }]);
  };

  const eliminarFondo = (id: number) => {
    if (fondos.length > 1) {
      setFondos(fondos.filter(f => f.id !== id));
    }
  };

  const actualizarFondo = (id: number, campo: keyof FundItem, valor: string) => {
    setFondos(fondos.map(f => 
      f.id === id ? { ...f, [campo]: valor } : f
    ));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!area.trim()) {
        throw new Error('El área es obligatoria');
      }
      if (!lugar.trim()) {
        throw new Error('El lugar es obligatorio');
      }
      if (!fechaInicio) {
        throw new Error('La fecha de inicio es obligatoria');
      }
      if (!fechaFinalizacion) {
        throw new Error('La fecha de finalización es obligatoria');
      }
      if (new Date(fechaFinalizacion) < new Date(fechaInicio)) {
        throw new Error('La fecha de finalización debe ser posterior a la fecha de inicio');
      }

      // Validar que haya al menos un fondo con descripción
      const fondosValidos = fondos.filter(f => f.descripcion.trim());
      if (fondosValidos.length === 0) {
        throw new Error('Debe agregar al menos un ítem de fondos');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `SFON - ${titulo}`;

      // Construir las notas con toda la información
      const fechaSolicitud = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz'
      });

      // Calcular total
      const totalBolivianos = fondosValidos.reduce((sum, f) => {
        const importe = parseFloat(f.importeBolivianos) || 0;
        return sum + importe;
      }, 0);

      const fondosTexto = fondosValidos.map((f, index) => 
        `${index + 1}. ${f.descripcion}
   Importe: Bs. ${f.importeBolivianos || '0'}`
      ).join('\n\n');

      const fechaInicioStr = new Date(fechaInicio).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });
      const fechaFinalizacionStr = new Date(fechaFinalizacion).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });

      const jsonData = {
        tipo: 'Solicitud de Fondos',
        titulo,
        area,
        lugar,
        fechaInicio: fechaInicioStr,
        fechaFinalizacion: fechaFinalizacionStr,
        fechaSolicitud,
        fechaAprobacion: '',
        totalBolivianos: parseFloat(totalBolivianos.toFixed(2)),
        usuario: user ? { nombre: user.name, email: user.email, rol: user.role } : undefined,
        solicitante,
        cargo,
        fondos: fondosValidos.map(({ id, descripcion, importeBolivianos }) => ({
          id, descripcion,
          importeBolivianos: importeBolivianos || '0',
        })),
      };

      const notes = `SFON

Actividad: ${titulo}

INFORMACIÓN GENERAL:
• Área: ${area}
• Lugar de entrega: ${lugar}
• Fecha de inicio: ${fechaInicioStr}
• Fecha de finalización: ${fechaFinalizacionStr}
• Fecha de solicitud: ${fechaSolicitud}

FONDOS SOLICITADOS:
${fondosTexto}

TOTAL: Bs. ${totalBolivianos.toFixed(2)}

---
Solicitud generada automáticamente desde el sistema de reportes CDIMA

===DATOS_JSON===
${JSON.stringify(jsonData, null, 2)}
===FIN_DATOS_JSON===`;

      // Obtener el workspace: directo en la tarea (subtareas) o desde el primer proyecto
      const workspaceGid = task.workspace?.gid ?? task.projects?.[0]?.workspace?.gid;
      if (!workspaceGid) {
        throw new Error('No se pudo obtener el workspace de la tarea');
      }

      // Preparar custom_fields solo si la tarea pertenece a un proyecto
      // (las sub-subtareas no heredan custom fields de proyecto)
      const customFields: Record<string, string> = {};
      if (task.projects && task.projects.length > 0) {
        const tipoSolicitudField = task.custom_fields?.find(
          field => field.name === 'Tipo de Solicitud'
        );
        if (tipoSolicitudField?.gid) {
          const solicitudFondosValue = tipoSolicitudField.enum_options?.find(
            option => option.name === 'Solicitud de Fondos'
          );
          if (solicitudFondosValue?.gid) {
            customFields[tipoSolicitudField.gid] = solicitudFondosValue.gid;
          }
        }
      }

      // Crear la subtarea
      await asanaService.createSubtask(task.gid, workspaceGid, {
        name: subtaskName,
        notes: notes,
        due_on: fechaFinalizacion,
        completed: true,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
      });

      setNotification({ message: '¡Solicitud de fondos creada exitosamente!', type: 'success' });
      
      // Generar PDF automáticamente
      setTimeout(() => {
        exportFundsRequestToPDF({
          taskName: titulo,
          area,
          lugar,
          fechaInicio,
          fechaFinalizacion,
          fondos: fondosValidos,
          projectName,
          parentTaskName: task.name,
          fechaGeneracion: fechaSolicitud,
          solicitante,
          cargo,
        });
      }, 500);
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1001 }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <HtmlModalHeader icon="💰" title="Solicitud de Fondos" subtitle="Ingrese los datos de la solicitud" onClose={onClose} />
          <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

            <Form layout="vertical">
          <Form.Item label={<strong>Título de la solicitud</strong>} required>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
            />
          </Form.Item>

          <SectionHeader title="Información General" color="#1565C0" icon={<InfoCircleOutlined />} />

          <Form.Item label="Solicitante">
            <Input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Nombre del solicitante"
            />
          </Form.Item>

          <Form.Item label="Cargo">
            <Input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Cargo del solicitante (opcional)"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Área" required>
                <Select
                  value={area || undefined}
                  onChange={setArea}
                  placeholder="Seleccione un área"
                  style={{ width: '100%' }}
                  options={[
                    { value: 'Erradicación de Violencia', label: 'Erradicación de Violencia' },
                    { value: 'Empoderamiento Político', label: 'Empoderamiento Político' },
                    { value: 'Empoderamiento Productivo', label: 'Empoderamiento Productivo' },
                    { value: 'Administrativa y Financiera', label: 'Administrativa y Financiera' },
                    { value: 'Comunicación', label: 'Comunicación' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Lugar de Entrega" required>
                <Input
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder="Ej: Oficina Central"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Fecha de inicio" required>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Fecha de finalización" required>
                <Input type="date" value={fechaFinalizacion} onChange={(e) => setFechaFinalizacion(e.target.value)} />
              </Form.Item>
            </Col>
          </Row>

          <SectionHeader title="Fondos Solicitados" color="#15803d" icon={<DollarOutlined />} />

          {fondos.map((fondo, index) => (
            <Card
              key={fondo.id}
              size="small"
              style={{ marginBottom: 12, borderRadius: 6, borderColor: '#e5e7eb' }}
              title={<Typography.Text strong>Ítem {index + 1}</Typography.Text>}
              extra={
                fondos.length > 1 && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => eliminarFondo(fondo.id)} />
                )
              }
            >
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item label="Descripción" required style={{ marginBottom: 0 }}>
                    <Input
                      value={fondo.descripcion}
                      onChange={(e) => actualizarFondo(fondo.id, 'descripcion', e.target.value)}
                      placeholder="Descripción del gasto"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Importe (Bs.)" required style={{ marginBottom: 0 }}>
                    <Input
                      type="number"
                      value={fondo.importeBolivianos}
                      onChange={(e) => actualizarFondo(fondo.id, 'importeBolivianos', e.target.value)}
                      placeholder="0.00"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}

          <Button type="dashed" icon={<PlusOutlined />} onClick={agregarFondo} style={{ width: '100%', marginBottom: 12 }}>
            Agregar Ítem
          </Button>

          {fondos.filter(f => f.importeBolivianos).length > 0 && (
            <Card
              size="small"
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0', borderRadius: 6, textAlign: 'right' }}
            >
              <Typography.Text strong style={{ fontSize: 15 }}>
                Total: Bs. {fondos.reduce((sum, f) => sum + (parseFloat(f.importeBolivianos) || 0), 0).toFixed(2)}
              </Typography.Text>
            </Card>
          )}
        </Form>
          </div>
          <div className="modal-footer" style={{ borderTop: '1px solid #e0e0e0', padding: '1rem 1.5rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{ border: '1px solid #d9d9d9', background: '#fff', padding: '0.5rem 1.25rem', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button type="button" onClick={handleSubmit} disabled={loading} className="button-primary">{loading ? 'Guardando...' : 'Crear Solicitud'}</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FundsRequestModal;
