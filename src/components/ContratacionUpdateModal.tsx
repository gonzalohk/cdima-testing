import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { AsanaTask } from '../types/asana.types';
import { asanaService } from '../services/asana.service';

const ESTADOS = [
  'Requerimiento de contratación',
  'Elaboración de TDRs',
  'Lanzamiento de convocatoria',
  'Selección del consultor',
  'Informe final del consultor',
];

interface ArchivoAdjunto {
  id: number;
  nombre: string;
  link: string;
}

export interface HistorialEstado {
  estado: string;
  fecha: string;
  observaciones: string;
  archivos: { nombre: string; link: string }[];
}

export interface ContratacionJsonData {
  tipo: string;
  actividad: string;
  subarea: string;
  descripcion: string | null;
  fechaGeneracion: string;
  estadoActual: string;
  historialEstados: HistorialEstado[];
}

interface ContratacionUpdateModalProps {
  contratacion: AsanaTask;
  currentData: ContratacionJsonData;
  onClose: () => void;
  onSuccess: () => void;
}

const ContratacionUpdateModal: React.FC<ContratacionUpdateModalProps> = ({
  contratacion,
  currentData,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([]);
  const [loading, setLoading] = useState(false);

  const agregarArchivo = () => {
    const newId = Math.max(...archivos.map(a => a.id), 0) + 1;
    setArchivos([...archivos, { id: newId, nombre: '', link: '' }]);
  };

  const eliminarArchivo = (id: number) => {
    setArchivos(archivos.filter(a => a.id !== id));
  };

  const actualizarArchivo = (id: number, campo: 'nombre' | 'link', valor: string) => {
    setArchivos(archivos.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  };

  const handleSubmit = async () => {
    let values: { estado: string; observaciones?: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setLoading(true);
    try {
      const archivosValidos = archivos.filter(a => a.nombre.trim() || a.link.trim());
      for (const archivo of archivosValidos) {
        if (!archivo.nombre.trim()) throw new Error('Cada archivo debe tener un nombre');
        if (!archivo.link.trim()) throw new Error('Cada archivo debe tener un enlace');
        if (!archivo.link.startsWith('http')) throw new Error(`El enlace "${archivo.nombre}" no parece una URL válida`);
      }

      const fecha = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/La_Paz',
      });

      const nuevoRegistro: HistorialEstado = {
        estado: values.estado,
        fecha,
        observaciones: (values.observaciones ?? '').trim(),
        archivos: archivosValidos.map(({ nombre, link }) => ({ nombre: nombre.trim(), link: link.trim() })),
      };

      const updatedData: ContratacionJsonData = {
        ...currentData,
        estadoActual: values.estado,
        historialEstados: [...(currentData.historialEstados ?? []), nuevoRegistro],
      };

      const notasBase = (contratacion.notes ?? '')
        .replace(/\n*===DATOS_JSON===[\s\S]*?===FIN_DATOS_JSON===/, '')
        .trimEnd();

      const newNotes = `${notasBase}\n\n===DATOS_JSON===\n${JSON.stringify(updatedData, null, 2)}\n===FIN_DATOS_JSON===`;

      await asanaService.updateTask(contratacion.gid, { notes: newNotes });
      message.success('Estado actualizado exitosamente');
      setTimeout(() => onSuccess(), 600);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Error al actualizar el estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      title={<><span style={{ marginRight: 8 }}>📋</span>Actualizar Estado — {currentData.subarea}</>}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>Cancelar</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          Guardar actualización
        </Button>,
      ]}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingTop: 8 } }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ estado: currentData.estadoActual || ESTADOS[0] }}
      >
        <Form.Item
          name="estado"
          label="Estado"
          rules={[{ required: true, message: 'Seleccione un estado' }]}
        >
          <Select options={ESTADOS.map(e => ({ value: e, label: e }))} />
        </Form.Item>

        <Form.Item name="observaciones" label={<>Observaciones <Typography.Text type="secondary" style={{ fontWeight: 400 }}>(opcional)</Typography.Text></>}>
          <Input.TextArea
            placeholder="Notas u observaciones sobre este cambio de estado..."
            rows={3}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        {/* Archivos */}
        <Form.Item
          label={
            <Space>
              <span>Archivos (Google Drive)</span>
              <Typography.Text type="secondary" style={{ fontWeight: 400 }}>(opcional)</Typography.Text>
            </Space>
          }
        >
          {archivos.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
              Sin archivos. Use el botón para agregar enlaces de Google Drive.
            </Typography.Text>
          )}
          <Space direction="vertical" style={{ width: '100%' }}>
            {archivos.map((archivo) => (
              <Space key={archivo.id} style={{ width: '100%' }} align="start">
                <Input
                  placeholder="Nombre del archivo"
                  value={archivo.nombre}
                  onChange={(e) => actualizarArchivo(archivo.id, 'nombre', e.target.value)}
                  style={{ width: 180 }}
                  maxLength={200}
                />
                <Input
                  placeholder="https://drive.google.com/..."
                  value={archivo.link}
                  onChange={(e) => actualizarArchivo(archivo.id, 'link', e.target.value)}
                  style={{ width: 260 }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => eliminarArchivo(archivo.id)}
                />
              </Space>
            ))}
            <Button icon={<PlusOutlined />} onClick={agregarArchivo} size="small">
              Agregar archivo
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ContratacionUpdateModal;
