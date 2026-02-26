# Guía de Despliegue

## 🚀 Opciones de Despliegue

Esta aplicación es 100% frontend y puede desplegarse en cualquier servicio de hosting estático.

## 📦 Preparación

Antes de desplegar, compila la aplicación:

```bash
npm run build
```

Esto genera la carpeta `dist/` con todos los archivos optimizados para producción.

---

## 1. Vercel (Recomendado)

### Opción A: Deploy desde Git

1. Sube tu código a GitHub/GitLab/Bitbucket
2. Ve a [vercel.com](https://vercel.com)
3. Haz clic en "New Project"
4. Importa tu repositorio
5. Vercel detectará automáticamente Vite
6. Haz clic en "Deploy"

### Opción B: Deploy con CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Compilar
npm run build

# Deploy
vercel --prod
```

**Variables de entorno**: No necesarias (el token se guarda en el navegador)

---

## 2. Netlify

### Opción A: Deploy desde Git

1. Sube tu código a GitHub
2. Ve a [netlify.com](https://netlify.com)
3. Haz clic en "New site from Git"
4. Selecciona tu repositorio
5. Configuración:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Haz clic en "Deploy"

### Opción B: Deploy con CLI

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Compilar
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Opción C: Drag & Drop

1. Compila: `npm run build`
2. Ve a [app.netlify.com/drop](https://app.netlify.com/drop)
3. Arrastra la carpeta `dist/`

---

## 3. GitHub Pages

### Configuración

1. **Crear `vite.config.ts` con base path:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/cdima-reportes/', // Reemplaza con el nombre de tu repo
})
```

2. **Instalar gh-pages:**

```bash
npm install --save-dev gh-pages
```

3. **Agregar scripts en `package.json`:**

```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

4. **Desplegar:**

```bash
npm run deploy
```

5. **Configurar en GitHub:**
   - Ve a Settings → Pages
   - Source: Deploy from a branch
   - Branch: gh-pages / root

Tu sitio estará en: `https://username.github.io/cdima-reportes/`

---

## 4. Firebase Hosting

### Setup

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar
firebase init hosting
```

### Configuración

Cuando te pregunte:
- Public directory: `dist`
- Configure as SPA: `Yes`
- Automatic builds: `No`

### Deploy

```bash
# Compilar
npm run build

# Desplegar
firebase deploy --only hosting
```

---

## 5. Cloudflare Pages

### Opción A: Desde Git

1. Ve a [pages.cloudflare.com](https://pages.cloudflare.com)
2. Conecta tu repositorio de Git
3. Configuración:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output: `dist`
4. Deploy

### Opción B: Deploy directo

```bash
# Instalar Wrangler
npm install -g wrangler

# Compilar
npm run build

# Deploy
wrangler pages publish dist
```

---

## 6. Render

1. Ve a [render.com](https://render.com)
2. New → Static Site
3. Conecta tu repositorio
4. Configuración:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
5. Create Static Site

---

## 7. Surge.sh (Rápido para testing)

```bash
# Instalar Surge
npm install -g surge

# Compilar
npm run build

# Deploy
cd dist
surge
```

---

## ⚙️ Configuración Post-Deploy

### CORS (Si es necesario)

La API de Asana maneja CORS, pero si tienes problemas:

1. Verifica que estés usando HTTPS
2. Asana API solo funciona desde dominios seguros

### Custom Domain

Todos los servicios permiten configurar un dominio personalizado:

- Vercel: Settings → Domains
- Netlify: Site settings → Domain management
- GitHub Pages: Settings → Pages → Custom domain

### HTTPS

Todos los servicios mencionados proporcionan HTTPS automáticamente.

---

## 🔧 Variables de Entorno

Esta aplicación **NO requiere variables de entorno** en el servidor porque:
- El token de Asana se guarda en localStorage del navegador
- No hay backend
- Todo corre en el cliente

---

## ✅ Checklist de Deploy

- [ ] Compilar: `npm run build`
- [ ] Verificar que `dist/` se generó correctamente
- [ ] Probar localmente: `npm run preview`
- [ ] Subir a servicio de hosting
- [ ] Verificar que el sitio carga
- [ ] Probar funcionalidad de login con token
- [ ] Probar generación de reportes
- [ ] Probar exportación a PDF
- [ ] Verificar en móvil

---

## 🐛 Troubleshooting

### Error 404 en rutas

**Problema**: Las rutas como `/report` dan 404 al recargar.

**Solución**: Configurar redirects en tu hosting:

**Netlify** - Crear `public/_redirects`:
```
/*    /index.html   200
```

**Vercel** - Crear `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Firebase** - Ya está configurado con SPA

### La API de Asana no responde

**Causas posibles**:
- El sitio no está en HTTPS
- Token inválido o expirado
- Problemas de CORS (raro)

**Solución**: Asegúrate de que tu sitio esté en HTTPS

### Archivos no se actualizan

**Causa**: Cache del navegador

**Solución**: 
- Ctrl+Shift+R (hard reload)
- Limpiar caché del navegador
- Vite agrega hash a los archivos, debería actualizarse automáticamente

---

## 📊 Monitoreo

### Analytics (Opcional)

Puedes agregar:
- Google Analytics
- Plausible
- Umami

Solo necesitas agregar el script en `index.html`

### Error Tracking (Opcional)

- Sentry
- Rollbar
- LogRocket

---

## 🔒 Seguridad

### Recomendaciones

1. **HTTPS obligatorio** - Todos los servicios lo proporcionan
2. **No hardcodear tokens** - Siempre pedir al usuario
3. **Content Security Policy** - Agregar headers si es necesario
4. **Regular updates** - Mantener dependencias actualizadas

### Headers de Seguridad (Opcional)

**Netlify** - Crear `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
```

---

## 💰 Costos

Todos estos servicios tienen planes gratuitos suficientes para esta aplicación:

- ✅ Vercel: Gratis para proyectos personales
- ✅ Netlify: 100GB bandwidth/mes gratis
- ✅ GitHub Pages: Gratis para repos públicos
- ✅ Firebase: Spark plan (gratis)
- ✅ Cloudflare Pages: Unlimited gratis
- ✅ Render: Free tier disponible
- ✅ Surge: Gratis básico

---

## 🎯 Recomendación Final

Para esta aplicación, recomendamos:

**1. Vercel** - Más fácil, mejor DX
**2. Netlify** - Excelente alternativa
**3. GitHub Pages** - Si ya tienes el repo en GitHub

Cualquiera de estos te dará:
- Deploy automático en cada push
- HTTPS gratis
- CDN global
- Preview deployments
- Custom domains

---

**¡Listo para producción!** 🚀
