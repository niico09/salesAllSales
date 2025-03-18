# SalesAllSales

Este proyecto tiene como objetivo centralizar y comparar los precios y descuentos de videojuegos en Steam, Xbox y PlayStation. La herramienta permitirá a los usuarios encontrar las mejores ofertas en distintas plataformas de manera sencilla y rápida.

## Características Principales

- Búsqueda paginada de juegos (25 items por página)
- Filtros por:
  - Género
  - Desarrollador
  - Publisher
  - Porcentaje de descuento
  - Juegos gratuitos
- Actualización automática de precios y descuentos
- Exclusión automática de juegos sin categorizar o tipo desconocido
- Historial de precios para seguimiento de ofertas
- Procesamiento en paralelo con límite de concurrencia
- Caché de respuestas de API para reducir llamadas
- Manejo avanzado de errores y reintentos
- Conexiones a base de datos con pool de conexiones
- Seguridad mejorada con Helmet y CORS
- Monitoreo de salud de la aplicación

## Optimizaciones Implementadas

### Rendimiento

- **Procesamiento en Paralelo**: Actualización de múltiples juegos simultáneamente con límite de concurrencia
- **Caché**: Implementación de caché para reducir llamadas a la API de Steam
- **Escritura Optimizada**: Opciones de escritura para MongoDB que mejoran el rendimiento
- **Procesamiento por Lotes**: Actualización y sincronización de juegos en lotes para reducir el uso de memoria
- **Optimización de Esquemas**: Eliminación de campos `_id` innecesarios en subesquemas
- **Indexación Manual**: Creación de índices en segundo plano para mejorar el rendimiento

### Seguridad

- **Helmet**: Protección de cabeceras HTTP
- **CORS**: Configuración de orígenes permitidos
- **Rate Limiting**: Limitación de solicitudes por IP
- **Sanitización de Entradas**: Validación y sanitización de parámetros de entrada

### Robustez

- **Manejo de Errores**: Implementación de estructura de manejo de errores consistente
- **Reintentos**: Lógica de reintento con backoff exponencial para operaciones fallidas
- **Cierre Graceful**: Manejo adecuado de señales de terminación
- **Logging**: Sistema de logging estructurado con Winston
- **Monitoreo**: Endpoint de health check para monitoreo de la aplicación

## Requisitos

- Node.js 18 o superior
- MongoDB
- Variables de entorno configuradas (ver .env.example)

## Instalación

1. Clonar el repositorio:

```bash
git clone https://github.com/niico09/salesAllSales.git
cd salesAllSales
```

1. Instalar dependencias:

```bash
npm install
```

1. Configurar variables de entorno:

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

1. Iniciar la aplicación:

```bash
npm start
```

## Uso con Docker

1. Construir la imagen:

```bash
docker build -t sales-all-sales .
```

1. Ejecutar el contenedor:

```bash
docker run -p 3000:3000 --env-file .env sales-all-sales
```

1. Usar Docker Compose:

```bash
docker-compose up -d
```

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| PORT | Puerto del servidor | 3000 |
| MONGODB_URI | URI de conexión a MongoDB | mongodb://localhost:27017/salesAllSales |
| STEAM_API_KEY | Clave de API de Steam | - |
| CORS_ORIGIN | Orígenes permitidos para CORS | * |
| LOG_LEVEL | Nivel de logging | info |
| MONGO_MAX_POOL_SIZE | Tamaño máximo del pool de conexiones | 10 |
| MONGO_MIN_POOL_SIZE | Tamaño mínimo del pool de conexiones | 2 |
| MONGO_MAX_RETRIES | Número máximo de reintentos de conexión | 5 |
| MONGO_RETRY_INTERVAL | Intervalo entre reintentos (ms) | 1000 |

## API Endpoints

### GET /api/games

Retorna una lista paginada de juegos.

Parámetros de query:

- `page`: Número de página (default: 1)
- `pageSize`: Cantidad de items por página (default: 25, max: 50)
- `genre`: Filtrar por género
- `publisher`: Filtrar por publisher
- `developer`: Filtrar por desarrollador
- `discountPercent`: Filtrar por porcentaje exacto de descuento
- `minDiscount`: Filtrar por descuento mínimo
- `maxDiscount`: Filtrar por descuento máximo
- `isFree`: Filtrar juegos gratuitos

### GET /health

Retorna el estado de salud de la aplicación.

## Pruebas

Ejecutar pruebas unitarias:

```bash
npm test
```

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

MIT
