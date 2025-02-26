# Usar una imagen base específica para producción
FROM node:18-alpine

# Crear un usuario no root para mayor seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && \
    # Limpiar caché de npm para reducir el tamaño de la imagen
    npm cache clean --force

# Cambiar al usuario no root
USER appuser

# Copiar el código fuente de la aplicación
COPY --chown=appuser:appgroup . .

# Exponer el puerto de la aplicación
EXPOSE 3000

# Configurar variables de entorno para producción
ENV NODE_ENV=production

# Healthcheck para monitoreo
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando para iniciar la aplicación
CMD ["npm", "start"]
