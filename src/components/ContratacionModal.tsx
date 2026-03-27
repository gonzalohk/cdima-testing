import React, { useState } from 'react';
import { Alert, Form, Input, Modal, Typography } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { ModalTitle, modalCloseIcon, modalStyles, modalFooterButtons } from './ModalShared';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';
import Notification from './Notification';

interface ContratacionModalProps {
  task: AsanaTask;
  onClose: () => void;
  onSuccess: () => void;
}

const ContratacionModal: React.FC<ContratacionModalProps> = ({ task, onClose, onSuccess }) => {
  const [subarea, setSubarea] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Validaciones
      if (!subarea.trim()) {
        throw new Error('El nombre del subárea es obligatorio');
      }

      // Evitar entradas con solo espacios o caracteres especiales
      if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(subarea)) {
        throw new Error('El nombre del subárea debe contener texto válido');
      }

      if (!window.confirm(`¿Crear solicitud de contratación para el subárea "${subarea.trim()}"?\n\nEsta acción creará una subtarea en Asana.`)) {
        setLoading(false);
        return;
      }

      // Construir el nombre de la subtarea
      const subtaskName = `CPER - ${subarea.trim()}`;

      // Obtener workspaces
      const workspaces = await asanaService.getWorkspaces();
      const cdima = workspaces.find(ws => ws.name === 'CDIMA');
      
      if (!cdima) {
        throw new Error('No se encontró el workspace CDIMA');
      }

      // Preparar las notas con la información
      const fechaGeneracion = new Date().toLocaleDateString('es-ES');

      const jsonData = {
        tipo: 'Contratacion',
        actividad: task.name,
        subarea: subarea.trim(),
        descripcion: descripcion.trim() || null,
        fechaGeneracion,
        estadoActual: '',
        historialEstados: [],
      };

      const notes = `Solicitud de Contratación
Actividad: ${task.name}
• Subárea: ${subarea}
${descripcion ? `• Descripción: ${descripcion}` : ''}

---
Generado el: ${fechaGeneracion}

===DATOS_JSON===
${JSON.stringify(jsonData, null, 2)}
===FIN_DATOS_JSON===`;

      // Preparar custom_fields si existe el campo "Tipo de Solicitud" y/o "Estado"
      const tipoSolicitudField = task.custom_fields?.find(
        field => field.name === 'Tipo de Solicitud'
      );
      const estadoField = task.custom_fields?.find(
        field => field.name === 'Estado'
      );
      const customFields: Record<string, string> = {};
      if (tipoSolicitudField?.gid) {
        const solicitudContratacionValue = tipoSolicitudField.enum_options?.find(
          option => option.name === 'Solicitar Contratacion'
        );
        if (solicitudContratacionValue?.gid) {
          customFields[tipoSolicitudField.gid] = solicitudContratacionValue.gid;
        }
      }
      if (estadoField?.gid) {
        const enProcesoValue = estadoField.enum_options?.find(
          option => option.name === 'EN PROCESO'
        );
        if (enProcesoValue?.gid) {
          customFields[estadoField.gid] = enProcesoValue.gid;
        }
      }

      // Crear la subtarea en Asana
      await asanaService.createSubtask(task.gid, cdima.gid, {
        name: subtaskName,
        notes: notes,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : undefined
      });

      // Mostrar notificación de éxito
      setNotification({
        message: '✓ Solicitud de contratación creada exitosamente',
        type: 'success'
      });

      // Esperar un momento antes de cerrar para que se vea la notificación
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la solicitud de contratación');
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
      <Modal
        title={<ModalTitle icon={<TeamOutlined />} title="Solicitud de Contratación" subtitle="Registre los datos de la nueva contratación" />}
        open={true}
        onCancel={onClose}
        width={560}
        closeIcon={modalCloseIcon}
        styles={modalStyles}
        footer={modalFooterButtons(onClose, handleSubmit, loading, 'Crear Solicitud')}      >
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8faff', borderRadius: 6, border: '1px solid #e0e7ff' }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            <strong>Actividad:</strong> {task.name}
          </Typography.Text>
        </div>

        <Form layout="vertical">
          <Form.Item
            label={
              <>
                Nombre del Subárea{' '}
                <Typography.Text type="danger">*</Typography.Text>
              </>
            }
          >
            <Input
              value={subarea}
              onChange={(e) => setSubarea(e.target.value)}
              placeholder="Ej: Coordinador de Proyectos"
              disabled={loading}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              La subtarea se creará como: "CPER - {subarea || '[nombre]'}"
            </Typography.Text>
          </Form.Item>

          <Form.Item label="Descripción (Opcional)">
            <Input.TextArea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción adicional sobre la contratación..."
              rows={4}
              disabled={loading}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ContratacionModal;
