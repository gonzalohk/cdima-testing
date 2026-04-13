import React, { useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Typography } from 'antd';
import {
  DeleteOutlined, PlusOutlined,
  EnvironmentOutlined, AppstoreOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { SectionHeader, HtmlModalHeader } from './ModalShared';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import { exportMaterialRequestToPDF } from '../services/pdf.service';
import Notification from './Notification';
import { useAuth } from '../context/AuthContext';


interface MaterialItem {
  id: number;
  detalle: string;
  cantidad: string;
  unidad: string;
  observaciones: string;
}

interface MaterialRequestModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}


const MaterialRequestModal: React.FC<MaterialRequestModalProps> = ({ task, onClose, onSuccess }) => {
  const [area, setArea] = useState('');
  const [titulo, setTitulo] = useState('');
  const [lugar, setLugar] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinalizacion, setFechaFinalizacion] = useState('');
  const [materiales, setMateriales] = useState<MaterialItem[]>([
    { id: 1, detalle: '', cantidad: '', unidad: '', observaciones: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { user } = useAuth();

  const agregarMaterial = () => {
    const newId = Math.max(...materiales.map(m => m.id), 0) + 1;
    setMateriales([...materiales, { id: newId, detalle: '', cantidad: '', unidad: '', observaciones: '' }]);
  };

  const eliminarMaterial = (id: number) => {
    if (materiales.length > 1) {
      setMateriales(materiales.filter(m => m.id !== id));
    }
  };

  const actualizarMaterial = (id: number, campo: keyof MaterialItem, valor: string) => {
    setMateriales(materiales.map(m => 
      m.id === id ? { ...m, [campo]: valor } : m
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

      // Validar que haya al menos un material con detalle
      const materialesValidos = materiales.filter(m => m.detalle.trim());
      if (materialesValidos.length === 0) {
        throw new Error('Debe agregar al menos un material');
      }

      // Construir el nombre de la subtarea
      const subtaskName = `SMAT - ${titulo}`;

      // Construir las notas con toda la información
      const fechaSolicitud = new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/La_Paz'
      });

      const materialesTexto = materialesValidos.map((m, index) => 
        `${index + 1}. ${m.detalle}
   Cantidad: ${m.cantidad || '-'}
   Unidad: ${m.unidad || '-'}
   Observaciones: ${m.observaciones || '-'}`
      ).join('\n\n');

      const fechaInicioStr = new Date(fechaInicio).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });
      const fechaFinalizacionStr = new Date(fechaFinalizacion).toLocaleDateString('es-ES', { timeZone: 'America/La_Paz' });

      const jsonData = {
        tipo: 'Solicitud de Material',
        titulo,
        area,
        lugar,
        fechaInicio: fechaInicioStr,
        fechaFinalizacion: fechaFinalizacionStr,
        fechaSolicitud,
        fechaAprobacion: '',
        usuario: user ? { nombre: user.name, email: user.email, rol: user.role } : undefined,
        materiales: materialesValidos.map(({ id, detalle, cantidad, unidad, observaciones }) => ({
          id, detalle,
          cantidad: cantidad || '-',
          unidad: unidad || '-',
          observaciones: observaciones || '-',
        })),
      };

      const notes = `SMAT

Actividad: ${titulo}

INFORMACIÓN GENERAL:
• Área: ${area}
• Lugar de entrega: ${lugar}
• Fecha de inicio: ${fechaInicioStr}
• Fecha de finalización: ${fechaFinalizacionStr}
• Fecha de solicitud: ${fechaSolicitud}

MATERIALES SOLICITADOS:
${materialesTexto}

---
Solicitud generada automáticamente desde el sistema de reportes CDIMA

===DATOS_JSON===
${JSON.stringify(jsonData, null, 2)}
===FIN_DATOS_JSON===`;

      // Obtener el workspace del primer proyecto de la tarea
      const workspaceGid = task.projects?.[0]?.workspace?.gid;
      if (!workspaceGid) {
        throw new Error('No se pudo obtener el workspace de la tarea');
      }

      // Buscar el campo personalizado "Tipo de Solicitud"
      const tipoSolicitudField = task.custom_fields?.find(
        field => field.name === 'Tipo de Solicitud'
      );
      
      // Preparar custom_fields si existe el campo
      const customFields: Record<string, string> = {};
      if (tipoSolicitudField?.gid) {
        // Buscar el enum_value para "Solicitud de Material"
        const solicitudMaterialValue = tipoSolicitudField.enum_options?.find(
          option => option.name === 'Solicitud de Material'
        );
        
        if (solicitudMaterialValue?.gid) {
          customFields[tipoSolicitudField.gid] = solicitudMaterialValue.gid;
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

      setNotification({ message: '¡Solicitud de material creada exitosamente!', type: 'success' });
      
      // Generar PDF automáticamente
      setTimeout(() => {
        exportMaterialRequestToPDF({
          taskName: titulo,
          area,
          lugar,
          fechaInicio,
          fechaFinalizacion,
          materiales: materialesValidos
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
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '740px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <HtmlModalHeader icon="📦" title="Solicitud de Material" subtitle="Complete los datos para generar la solicitud" onClose={onClose} />
          <div className="modal-body" style={{ padding: '1.5rem 1.75rem', overflowY: 'auto' }}>
            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}

            <Form layout="vertical">
          {/* Título de la solicitud */}
          <Form.Item
            label={<Typography.Text strong style={{ color: '#374151' }}>Título de la solicitud</Typography.Text>}
            required
            style={{ marginBottom: 20 }}
          >
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
              size="large"
              style={{ borderRadius: 8 }}
              placeholder="Nombre descriptivo de la solicitud"
            />
          </Form.Item>

          {/* Sección: Información General */}
          <SectionHeader title="Información General" color="#1565C0" icon={<InfoCircleOutlined />} />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Área" required>
                <Select
                  value={area || undefined}
                  onChange={setArea}
                  placeholder="Seleccione un área"
                  style={{ width: '100%', borderRadius: 8 }}
                  options={[
                    { value: 'Erradicación de Violencia', label: 'Erradicación de Violencia' },
                    { value: 'Empoderamiento Político', label: 'Empoderamiento Político' },
                    { value: 'Empoderamiento Productivo', label: 'Empoderamiento Productivo' },
                    { value: 'Administrativa y Financiera', label: 'Administrativa y Financiera' },
                    { value: 'Comunicación', label: 'Comunicación' },
                    { value: 'Dirección Ejecutiva', label: 'Dirección Ejecutiva' },
                    { value: 'Otros', label: 'Otros' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Lugar del Evento" required>
                <Input
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder="Ej: Oficina principal"
                  style={{ borderRadius: 8 }}
                  prefix={<EnvironmentOutlined style={{ color: '#9ca3af' }} />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={<Typography.Text style={{ fontSize: 12, color: '#6b7280' }}>Fecha de inicio</Typography.Text>}
                  required
                >
                  <Input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{ borderRadius: 8 }}
                    lang="es"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<Typography.Text style={{ fontSize: 12, color: '#6b7280' }}>Fecha de finalización</Typography.Text>}
                  required
                >
                  <Input
                    type="date"
                    value={fechaFinalizacion}
                    onChange={(e) => setFechaFinalizacion(e.target.value)}
                    min={fechaInicio || undefined}
                    style={{ borderRadius: 8 }}
                    lang="es"
                  />
                </Form.Item>
              </Col>
            </Row>


          {/* Sección: Materiales Solicitados */}
          <SectionHeader title="Materiales Solicitados" color="#388E3C" icon={<AppstoreOutlined />} />

          {materiales.map((material, index) => {
            return (
              <Card
                key={material.id}
                size="small"
                style={{
                  marginBottom: 12,
                  borderRadius: 8,
                  borderColor: '#e8e8e8',
                  background: '#fafafa',
                  boxShadow: 'none',
                }}
                title={
                  <Space size={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>#{index + 1}</Typography.Text>
                    <Typography.Text strong style={{ fontSize: 13, color: '#374151' }}>Material</Typography.Text>
                  </Space>
                }
                extra={
                  materiales.length > 1 && (
                    <Button
                      size="small"
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => eliminarMaterial(material.id)}
                      style={{ color: '#bfbfbf', borderRadius: 6 }}
                    />
                  )
                }
              >
                {/* Fila principal: Detalle | Cantidad | Unidad */}
                <Row gutter={8} align="top" wrap={false}>
                  <Col flex="auto">
                    <Form.Item label="Detalle" required style={{ marginBottom: 0 }}>
                      <Input
                        value={material.detalle}
                        onChange={(e) => actualizarMaterial(material.id, 'detalle', e.target.value)}
                        placeholder="Descripción del material"
                        style={{ borderRadius: 7 }}
                      />
                    </Form.Item>
                  </Col>
                  <Col style={{ width: 90 }}>
                    <Form.Item label="Cantidad" style={{ marginBottom: 0 }}>
                      <Input
                        value={material.cantidad}
                        onChange={(e) => actualizarMaterial(material.id, 'cantidad', e.target.value)}
                        placeholder="Ej: 10"
                        style={{ borderRadius: 7 }}
                      />
                    </Form.Item>
                  </Col>
                  <Col style={{ width: 100 }}>
                    <Form.Item label="Unidad" style={{ marginBottom: 0 }}>
                      <Input
                        value={material.unidad}
                        onChange={(e) => actualizarMaterial(material.id, 'unidad', e.target.value)}
                        placeholder="Ej: pzas"
                        style={{ borderRadius: 7 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {/* Observaciones: colapsable visualmente pero siempre visible */}
                <Form.Item label={<Typography.Text style={{ fontSize: 11, color: '#9ca3af' }}>Observaciones</Typography.Text>} style={{ marginBottom: 0, marginTop: 8 }}>
                  <Input
                    value={material.observaciones}
                    onChange={(e) => actualizarMaterial(material.id, 'observaciones', e.target.value)}
                    placeholder="Notas adicionales (opcional)"
                    style={{ borderRadius: 7 }}
                  />
                </Form.Item>
              </Card>
            );
          })}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={agregarMaterial}
            style={{
              width: '100%',
              borderRadius: 8,
              borderColor: '#388E3C',
              color: '#388E3C',
              fontWeight: 500,
              height: 40,
            }}
          >
            Agregar otro material
          </Button>
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

export default MaterialRequestModal;
