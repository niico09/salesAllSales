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

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request
