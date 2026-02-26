#!/bin/bash

# Script de inicio para CDIMA Reportes de Asana

echo "🚀 Iniciando CDIMA Reportes de Asana..."
echo ""

# Verificar que node esté instalado
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "Por favor instala Node.js desde https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo "✅ npm encontrado: $(npm --version)"
echo ""

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

echo "🎯 Iniciando servidor de desarrollo..."
echo ""
echo "La aplicación se abrirá en: http://localhost:5173"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar el servidor de desarrollo
npm run dev
