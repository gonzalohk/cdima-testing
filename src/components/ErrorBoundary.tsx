/**
 * ErrorBoundary Component
 * 
 * Captura errores de JavaScript en cualquier componente hijo y muestra
 * una UI de fallback en lugar de crashear toda la aplicación.
 * 
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary para capturar errores en componentes hijos
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Actualizar estado para renderizar UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log del error a consola para debugging
    console.error('ErrorBoundary capturó un error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Actualizar estado con información completa del error
    this.setState({
      error,
      errorInfo,
    });
    
    // Aquí podrías enviar el error a un servicio de logging como Sentry
    // logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Si se provee un fallback personalizado, usarlo
      if (fallback) {
        return fallback;
      }

      // UI de error por defecto
      return (
        <div
          style={{
            padding: '2rem',
            maxWidth: '800px',
            margin: '2rem auto',
            backgroundColor: '#fee2e2',
            borderRadius: '8px',
            border: '2px solid #dc2626',
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ color: '#991b1b', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              ⚠️ Algo salió mal
            </h1>
            <p style={{ color: '#7f1d1d', fontSize: '1rem' }}>
              La aplicación encontró un error inesperado. Por favor intenta recargar la página.
            </p>
          </div>

          {error && (
            <details
              style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#991b1b',
                  marginBottom: '0.5rem',
                }}
              >
                Detalles del error
              </summary>
              <pre
                style={{
                  fontSize: '0.85rem',
                  overflow: 'auto',
                  padding: '0.5rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  color: '#333',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <strong>Error:</strong> {error.toString()}
                {'\n\n'}
                {errorInfo?.componentStack && (
                  <>
                    <strong>Component Stack:</strong>
                    {errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '2px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
            >
              Recargar página
            </button>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#666',
            }}
          >
            <strong>💡 Consejos:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>Intenta recargar la página</li>
              <li>Verifica tu conexión a internet</li>
              <li>Si el problema persiste, contacta al administrador</li>
            </ul>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
