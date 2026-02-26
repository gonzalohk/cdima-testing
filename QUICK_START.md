# Guía Rápida de Inicio

## ⚡ Inicio Rápido (5 minutos)

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Iniciar la Aplicación
```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:5173`

### 3. Obtener tu Token de Asana

1. Visita: https://app.asana.com/0/my-apps
2. Haz clic en **"Create new token"**
3. Dale un nombre: "CDIMA Reportes"
4. **Copia el token** (guárdalo en un lugar seguro)

### 4. Configurar la Aplicación

1. Abre `http://localhost:5173` en tu navegador
2. Pega tu token en el campo "Token de Acceso"
3. Haz clic en **"Guardar Token"**
4. Ve a la página **"Reportes"**

### 5. Generar tu Primer Reporte

1. **Selecciona Workspace** → Elige tu workspace de Asana
2. **Selecciona Proyecto** → Elige el proyecto
3. **Selecciona Actividad** → Elige la tarea principal
4. ¡Listo! Verás toda la información y estadísticas
5. Haz clic en **"📄 Exportar a PDF"** para descargar el reporte

## 📊 ¿Qué puedes hacer?

- ✅ Ver información detallada de actividades
- ✅ Visualizar todas las subtareas
- ✅ Ver estadísticas de progreso
- ✅ Filtrar y buscar subtareas
- ✅ Ver distribución de trabajo por asignado
- ✅ Exportar reportes completos en PDF

## 🔑 Sobre el Token

El token se guarda **localmente en tu navegador** (localStorage):
- ❌ NO se envía a ningún servidor externo
- ✅ Solo se usa para conectar a la API de Asana
- 🔒 Es privado y seguro

## 🎯 Requisitos de Asana

Para que la aplicación funcione correctamente:

1. **Debes tener acceso** al workspace de Asana
2. El proyecto debe tener **tareas principales** (sin parent)
3. Las tareas principales deben tener **subtareas**
4. Tu token debe tener **permisos de lectura**

## 🚀 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo

# Producción
npm run build            # Compila para producción
npm run preview          # Vista previa de producción

# Verificación
npm run lint             # Ejecuta el linter
```

## ❓ Problemas Comunes

### No se cargan los proyectos
- Verifica tu conexión a internet
- Confirma que el token sea válido
- Asegúrate de tener acceso al workspace seleccionado

### No aparecen actividades principales
- Solo se muestran tareas **sin parent** (nivel superior)
- Verifica que el proyecto tenga tareas de nivel superior

### Error al exportar PDF
- Asegúrate de haber seleccionado una actividad
- Verifica que el navegador permita descargas

## 📞 ¿Necesitas Ayuda?

Consulta el archivo `README.md` para documentación completa.

---

**¡Disfruta generando tus reportes!** 🎉
