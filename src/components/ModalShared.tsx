/**
 * ModalShared.tsx
 * Estilos y componentes reutilizables para todos los modales CDIMA.
 * Importar desde aquí en lugar de definir estilos localmente en cada modal.
 */
import React from 'react';
import { Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

// ── Colores de la Wiphala boliviana (7 franjas) ───────────────────────────────
export const WIPHALA_COLORS = [
  '#D32F2F', '#E65100', '#F9A825', '#388E3C', '#1565C0', '#6A1B9A', '#880E4F',
];

// ── ModalTitle ────────────────────────────────────────────────────────────────
// Elemento JSX para el prop `title` de Ant Design <Modal>.
// Incluye la franja Wiphala, fondo degradado institucional, icono y texto.
interface ModalTitleProps {
  /** Icono de antd u otro ReactNode. Se renderiza en blanco dentro del badges. */
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Degradado del badge de icono [desde, hasta]. Por defecto: carbón oscuro. */
  iconGradient?: [string, string];
}

export const ModalTitle: React.FC<ModalTitleProps> = ({
  icon,
  title,
  subtitle,
  iconGradient = ['#37474F', '#263238'],
}) => (
  <div>
    {/* Franja Wiphala */}
    <div style={{ display: 'flex', height: 5, overflow: 'hidden', borderRadius: '8px 8px 0 0' }}>
      {WIPHALA_COLORS.map((color, i) => (
        <div key={i} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </div>
    {/* Cabecera degradada */}
    <div style={{
      padding: '14px 24px 12px',
      background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `linear-gradient(135deg, ${iconGradient[0]} 0%, ${iconGradient[1]} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', lineHeight: 1 }}>
            {icon}
          </span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2332', lineHeight: 1.3 }}>{title}</div>
          {subtitle && (
            <div style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', lineHeight: 1.3 }}>{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  </div>
);

// ── modalCloseIcon ────────────────────────────────────────────────────────────
// Botón X circular blanco para el prop `closeIcon` de Ant Design <Modal>.
export const modalCloseIcon = (
  <div style={{
    width: 28, height: 28, borderRadius: '50%', background: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
  }}>
    <CloseOutlined style={{ fontSize: 11, color: '#374151' }} />
  </div>
);

// ── modalStyles ───────────────────────────────────────────────────────────────
// Objeto `styles` estándar para todos los Ant Design <Modal>.
export const modalStyles = {
  header: { padding: 0, borderBottom: 'none' },
  body: { maxHeight: '70vh', overflowY: 'auto' as const, overflowX: 'hidden' as const, paddingTop: 16 },
};

// ── SectionHeader ─────────────────────────────────────────────────────────────
// Divisor de sección interno: icono de color + título + línea.
interface SectionHeaderProps {
  title: string;
  color: string;
  icon: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, color, icon }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7,
    paddingLeft: 2, paddingBottom: 8, marginBottom: 12, marginTop: 10,
    borderBottom: '1px solid #f0f0f0',
  }}>
    <span style={{ color, fontSize: 15, display: 'flex' }}>{icon}</span>
    <Typography.Text strong style={{ color: '#374151', fontSize: 13.5 }}>{title}</Typography.Text>
  </div>
);

// ── modalFooterButtons ────────────────────────────────────────────────────────
// Devuelve el array de botones del footer estándar (Cancelar + botón primario).
export const modalFooterButtons = (
  onClose: () => void,
  onSubmit: () => void,
  loading: boolean,
  submitLabel = 'Crear Solicitud',
): React.ReactNode[] => [
  <Button
    key="cancel"
    onClick={onClose}
    disabled={loading}
    type="text"
    style={{ borderRadius: 8, color: '#6b7280', marginRight: 8 }}
  >
    Cancelar
  </Button>,
  <Button
    key="submit"
    loading={loading}
    onClick={onSubmit}
    style={{
      borderRadius: 8,
      background: 'linear-gradient(135deg, #1565C0 0%, #2C5F8D 100%)',
      border: 'none',
      color: 'white',
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(21,101,192,0.3)',
    }}
  >
    {submitLabel}
  </Button>,
];

// ── HtmlModalHeader ───────────────────────────────────────────────────────────
// Reemplaza el <div className="modal-header"> de los modales HTML overlay.
// Incluye la franja Wiphala, cabecera degradada y botón X integrado.
interface HtmlModalHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
}

export const HtmlModalHeader: React.FC<HtmlModalHeaderProps> = ({ icon, title, subtitle, onClose }) => (
  <div style={{ borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
    {/* Franja Wiphala */}
    <div style={{ display: 'flex', height: 5 }}>
      {WIPHALA_COLORS.map((color, i) => (
        <div key={i} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </div>
    {/* Cabecera */}
    <div style={{
      padding: '14px 24px 12px',
      background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, #37474F 0%, #263238 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <span style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center' }}>{icon}</span>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2332', lineHeight: 1.3 }}>{title}</div>
          {subtitle && (
            <div style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', lineHeight: 1.3 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          width: 28, height: 28, borderRadius: '50%', background: 'white', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 6px rgba(0,0,0,0.25)', cursor: 'pointer',
          flexShrink: 0, fontSize: 13, color: '#374151', padding: 0,
        }}
      >
        <span style={{ lineHeight: 1 }}>✕</span>
      </button>
    </div>
  </div>
);
