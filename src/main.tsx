import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import App from './App.tsx';
import 'antd/dist/reset.css';
import './index.css';

dayjs.locale('es');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={esES}
      theme={{
        token: {
          colorPrimary: '#626262',
          borderRadius: 10,
          fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
