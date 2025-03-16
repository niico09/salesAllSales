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
- Integración con Twitter para compartir ofertas

## Requisitos

- Node.js 18 o superior
- MongoDB
- Variables de entorno configuradas (ver .env.example)
- Cuenta de desarrollador de Twitter (para la funcionalidad de compartir)

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/niico09/salesAllSales.git
cd salesAllSales
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. Iniciar la aplicación:
```bash
npm start
```

## Uso con Docker

1. Construir la imagen:
```bash
docker build -t sales-all-sales .
```

2. Ejecutar el contenedor:
```bash
docker run -p 3000:3000 --env-file .env sales-all-sales
```

## API Endpoints

### GET /games
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

## Integración con Twitter API

Se ha implementado la funcionalidad para publicar tweets utilizando la API de Twitter v2 con OAuth 2.0. Esta integración permite a los usuarios autorizar la aplicación para publicar tweets en su nombre.

### Características principales

- Autorización OAuth 2.0 para acceder a la cuenta de Twitter del usuario
- Publicación de tweets desde la aplicación
- Verificación del estado de autorización
- Almacenamiento seguro de tokens de acceso
- Renovación automática de tokens expirados

### Endpoints disponibles

- `GET /api/twitter/auth` - Inicia el proceso de autorización
- `GET /api/twitter/callback` - Maneja el callback de autorización
- `POST /api/twitter/tweet` - Publica un tweet
- `GET /api/twitter/status` - Verifica el estado de autorización

Para más detalles sobre la configuración y uso, consulta la [Guía de Integración con Twitter API](./docs/twitter-api-guide.md).

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request
