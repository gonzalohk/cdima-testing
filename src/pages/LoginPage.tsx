import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Typography, Alert } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import logoCdima from '../assets/logocdima.png';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(false);
    // Small delay to avoid instant flash
    await new Promise((r) => setTimeout(r, 300));
    const ok = login(values.email.trim(), values.password);
    setLoading(false);
    if (ok) {
      navigate('/', { replace: true });
    } else {
      setError(true);
    }
  };

  return (
    <div style={styles.wrapper}>
      <Card style={styles.card} styles={{ body: { padding: '2.5rem 2rem' } }}>
        {/* Logo + Title */}
        <div style={styles.logoRow}>
          <img src={logoCdima} alt="Logo CDIMA" style={styles.logo} />
        </div>
        <div style={styles.titleRow}>
          <Title level={3} style={{ margin: 0, color: '#2C3E50' }}>
            CDIMA Amuyt'a
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Sistema de Gestión de Proyectos y Control Académico
          </Text>
        </div>

        <div style={styles.divider} />

        {error && (
          <Alert
            message="Credenciales incorrectas. Verifica tu correo y contraseña."
            type="error"
            showIcon
            style={{ marginBottom: 20 }}
            closable
            onClose={() => setError(false)}
          />
        )}

        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            label="Correo electrónico"
            name="email"
            rules={[{ required: true, message: 'Ingresa tu correo' }]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bbb' }} />}
              placeholder="usuario@example.com"
              size="large"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="••••••••"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ background: '#626262', borderColor: '#4a4a4a' }}
            >
              Iniciar sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #626262 0%, #2C3E50 100%)',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  },
  logoRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  logo: {
    height: 90,
    objectFit: 'contain',
  },
  titleRow: {
    textAlign: 'center',
    marginBottom: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  divider: {
    height: 1,
    background: '#f0f0f0',
    margin: '1.25rem 0 1.5rem',
  },
};

export default LoginPage;
