# Guía para la Integración con la API de Twitter

## Índice
1. [Introducción](#introducción)
2. [Requisitos Previos](#requisitos-previos)
3. [Configuración del Proyecto de Desarrollador en Twitter](#configuración-del-proyecto-de-desarrollador-en-twitter)
4. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
5. [Flujo de Autorización OAuth 2.0](#flujo-de-autorización-oauth-20)
6. [Uso de la API](#uso-de-la-api)
7. [Solución de Problemas](#solución-de-problemas)
8. [Gestión de Tokens y Renovaciones](#gestión-de-tokens-y-renovaciones)

## Introducción

Esta guía explica cómo integrar la API de Twitter v2 con OAuth 2.0 en tu aplicación para publicar tweets. La implementación sigue los principios SOLID y las mejores prácticas de código limpio.

## Requisitos Previos

- Cuenta de desarrollador de Twitter (https://developer.twitter.com)
- Node.js y npm instalados
- Proyecto configurado con Express y MongoDB

## Configuración del Proyecto de Desarrollador en Twitter

1. **Crear una cuenta de desarrollador de Twitter**:
   - Visita [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Solicita acceso a la API si aún no lo tienes

2. **Crear un proyecto y una aplicación**:
   - En el Dashboard de desarrollador, crea un nuevo proyecto
   - Dentro del proyecto, crea una nueva aplicación
   - Selecciona el tipo de aplicación "Web App, Automated App or Bot"

3. **Configurar la autenticación OAuth 2.0**:
   - En la configuración de tu aplicación, navega a la sección "Authentication settings"
   - Habilita OAuth 2.0
   - Configura la URL de redirección: `http://localhost:3000/api/twitter/callback` (ajusta según tu entorno)
   - Selecciona los permisos (scopes) necesarios:
     - `tweet.read` (leer tweets)
     - `tweet.write` (escribir tweets)
     - `users.read` (leer información del usuario)
     - `offline.access` (para obtener refresh tokens)

4. **Obtener las credenciales**:
   - Guarda el Client ID y Client Secret que se te proporcionarán
   - Estos valores se usarán en la configuración de variables de entorno

## Configuración de Variables de Entorno

1. **Crear o editar el archivo .env**:
   - Usa como base el archivo `.env.example` proporcionado
   - Completa las siguientes variables:

```
# Credenciales de Twitter API v2 (OAuth 2.0)
TWITTER_CLIENT_ID=tu_client_id_de_twitter
TWITTER_CLIENT_SECRET=tu_client_secret_de_twitter
TWITTER_REDIRECT_URI=http://localhost:3000/api/twitter/callback
```

## Flujo de Autorización OAuth 2.0

El flujo de autorización OAuth 2.0 implementado en esta aplicación sigue estos pasos:

1. **Iniciar la autorización**:
   - El usuario accede a `/api/twitter/auth?userId=ID_DEL_USUARIO`
   - La aplicación redirige al usuario a la página de autorización de Twitter

2. **Autorización del usuario**:
   - El usuario inicia sesión en Twitter y autoriza la aplicación
   - Twitter redirige de vuelta a la aplicación con un código de autorización

3. **Intercambio de código por tokens**:
   - La aplicación recibe el código en el callback
   - Intercambia el código por tokens de acceso y actualización
   - Almacena los tokens en la base de datos MongoDB asociados al ID del usuario

4. **Uso de tokens para publicar tweets**:
   - La aplicación utiliza el token de acceso para realizar llamadas a la API
   - Si el token expira, se utiliza el token de actualización para obtener uno nuevo

## Uso de la API

### Endpoints Disponibles

1. **Iniciar Autorización**:
   ```
   GET /api/twitter/auth?userId=ID_DEL_USUARIO
   ```

2. **Verificar Estado de Autorización**:
   ```
   GET /api/twitter/status?userId=ID_DEL_USUARIO
   ```
   Respuesta:
   ```json
   {
     "authorized": true,
     "expiresAt": "2023-01-01T12:00:00.000Z"
   }
   ```

3. **Publicar un Tweet**:
   ```
   POST /api/twitter/tweet
   Content-Type: application/json
   
   {
     "userId": "ID_DEL_USUARIO",
     "text": "¡Hola mundo desde la API de Twitter!"
   }
   ```
   Respuesta:
   ```json
   {
     "success": true,
     "data": {
       "id": "1234567890",
       "text": "¡Hola mundo desde la API de Twitter!"
     }
   }
   ```

## Solución de Problemas

### Problemas Comunes

1. **Error 401 Unauthorized**:
   - Verifica que el usuario haya completado el proceso de autorización
   - Comprueba que los tokens no hayan expirado

2. **Error al obtener tokens**:
   - Verifica que las credenciales de la aplicación sean correctas
   - Asegúrate de que la URL de redirección coincida exactamente con la configurada en Twitter

3. **Límites de la API**:
   - La API de Twitter tiene límites de tasa. Consulta la [documentación oficial](https://developer.twitter.com/en/docs/twitter-api/rate-limits) para más detalles

### Logs y Depuración

La aplicación registra información detallada en los logs. Revisa los logs para identificar problemas específicos:

- Errores de autorización
- Problemas al refrescar tokens
- Errores al publicar tweets

## Gestión de Tokens y Renovaciones

La integración con Twitter API utiliza OAuth 2.0 para la autenticación, lo que implica el manejo de tokens de acceso y renovación. A continuación se detalla cómo funciona este proceso:

### Estructura de Almacenamiento

Los tokens se almacenan en la base de datos MongoDB utilizando el modelo `TwitterCredential` con la siguiente estructura:

```javascript
{
  userId: String,         // Identificador único del usuario
  accessToken: String,    // Token de acceso para la API
  refreshToken: String,   // Token de renovación
  tokenExpiry: Date,      // Fecha de expiración del token de acceso
  needsReauthorization: Boolean, // Indica si se requiere reautorización
  createdAt: Date,        // Fecha de creación del registro
  updatedAt: Date         // Fecha de última actualización
}
```

### Ciclo de Vida de los Tokens

1. **Obtención Inicial**: Durante el proceso de autorización, se obtienen tanto el token de acceso como el token de renovación.
   ```javascript
   // Ejemplo de respuesta de la API de Twitter
   {
     "access_token": "...",
     "refresh_token": "...",
     "expires_in": 7200  // Duración en segundos (2 horas)
   }
   ```

2. **Almacenamiento**: Los tokens se guardan en la base de datos asociados al ID del usuario.

3. **Verificación de Validez**: Antes de cada operación que requiera autenticación, el sistema verifica si el token de acceso es válido:
   - Si el token no ha expirado, se utiliza directamente.
   - Si el token está próximo a expirar (menos de 5 minutos), se renueva automáticamente.
   - Si se requiere reautorización, se notifica al usuario.

4. **Renovación Automática**: El sistema renueva automáticamente los tokens expirados utilizando el refresh token.

5. **Reautorización**: Cuando un refresh token expira o es invalidado por Twitter, se marca la credencial para reautorización.

### Proceso de Renovación

El proceso de renovación de tokens se maneja automáticamente por el servicio `twitterService` y sigue estos pasos:

1. Se detecta que un token está próximo a expirar o ya ha expirado.
2. Se utiliza el refresh token almacenado para solicitar un nuevo token de acceso.
3. Se actualiza la base de datos con el nuevo token de acceso y, si se proporciona, un nuevo refresh token.
4. Se actualiza la fecha de expiración.

### Sistema de Reintentos

Para mejorar la resiliencia, el sistema implementa un mecanismo de reintentos con backoff exponencial:

1. Si una solicitud falla debido a errores de red o errores del servidor (5xx), se reintenta automáticamente.
2. El tiempo de espera entre reintentos aumenta exponencialmente (1s, 2s, 4s, etc.).
3. Se limita el número máximo de reintentos para evitar bucles infinitos.

### Proceso de Reautorización

Cuando un refresh token es rechazado o expira, se sigue este proceso:

1. Se marca la credencial con `needsReauthorization = true`.
2. El endpoint `/api/twitter/status` informará al cliente que se requiere reautorización.
3. Cuando el usuario inicia el proceso de autorización nuevamente, se eliminan las credenciales antiguas.
4. Se completa el flujo de autorización OAuth 2.0 para obtener nuevos tokens.

### Manejo de Errores

El sistema está diseñado para manejar varios escenarios de error:

- **Token Expirado sin Refresh Token**: Si el token de acceso ha expirado y no hay un refresh token válido, el usuario deberá volver a autorizar la aplicación.
- **Refresh Token Inválido**: Si el refresh token es rechazado por Twitter, se notifica al usuario para que vuelva a autorizar la aplicación.
- **Errores de Red**: Se implementan reintentos para manejar errores temporales de red durante la renovación de tokens.
- **Errores de Autorización**: Si una operación falla por problemas de autorización, se intenta refrescar el token y reintentar la operación automáticamente.

### Respuestas de API para Reautorización

Cuando se requiere reautorización, las APIs responden con un formato especial:

```json
{
  "error": "Se requiere reautorización. El token ha expirado o es inválido.",
  "authUrl": "/api/twitter/auth?userId=ID_DEL_USUARIO",
  "needsReauthorization": true
}
```

El cliente puede utilizar esta información para redirigir al usuario a la URL de autorización.

### Seguridad

Para garantizar la seguridad de los tokens:

- Nunca se exponen los tokens en URLs o logs.
- Los tokens se almacenan de forma segura en la base de datos.
- Se utiliza HTTPS para todas las comunicaciones con la API de Twitter.
- Se implementa la validación de estado (state) para prevenir ataques CSRF durante el proceso de autorización.

### Consideraciones para Producción

En un entorno de producción, es recomendable considerar las siguientes mejoras:

1. **Cifrado de Tokens**: Cifrar los tokens almacenados en la base de datos para mayor seguridad.
2. **Permisos de Archivo**: Asegurar que la base de datos tenga permisos restrictivos (solo lectura/escritura para el usuario que ejecuta la aplicación).
3. **Respaldo**: Implementar un sistema de respaldo para la base de datos.
4. **Escalabilidad**: Para aplicaciones con alta carga, considerar migrar a una base de datos distribuida.

## Recursos Adicionales

- [Documentación oficial de la API de Twitter v2](https://developer.twitter.com/en/docs/twitter-api)
- [Guía de OAuth 2.0 para la API de Twitter](https://developer.twitter.com/en/docs/authentication/oauth-2-0)

## Guía de Integración con Twitter API

Esta guía te ayudará a configurar y utilizar la integración con Twitter API en la aplicación SalesAllSales.

### Requisitos Previos

Para utilizar la integración con Twitter, necesitarás:

1. Una cuenta de desarrollador de Twitter
2. Una aplicación registrada en el [Portal de Desarrolladores de Twitter](https://developer.twitter.com/en/portal/dashboard)

### Configuración de la Aplicación en Twitter

1. Inicia sesión en el [Portal de Desarrolladores de Twitter](https://developer.twitter.com/en/portal/dashboard)
2. Crea un nuevo proyecto y una aplicación dentro de ese proyecto
3. En la configuración de la aplicación:
   - Configura los permisos para incluir lectura y escritura de tweets
   - Añade la URL de callback: `http://localhost:3000/api/twitter/callback`
   - Guarda los cambios

### Configuración de Variables de Entorno

Para que la integración funcione correctamente, debes configurar las siguientes variables en tu archivo `.env`:

```
# Credenciales de Twitter API v2 (OAuth 2.0)
TWITTER_CLIENT_ID=tu_client_id_aquí
TWITTER_CLIENT_SECRET=tu_client_secret_aquí
TWITTER_REDIRECT_URI=http://localhost:3000/api/twitter/callback

# Configuración de sesiones
SESSION_SECRET=tu_secreto_seguro_para_sesiones
```

Donde:
- `TWITTER_CLIENT_ID`: Es el Client ID de tu aplicación de Twitter
- `TWITTER_CLIENT_SECRET`: Es el Client Secret de tu aplicación de Twitter
- `TWITTER_REDIRECT_URI`: Es la URL de callback configurada en tu aplicación de Twitter
- `SESSION_SECRET`: Es una cadena aleatoria para cifrar las sesiones

### Uso de la API

#### Autorización

Para autorizar a un usuario a utilizar la API de Twitter, redirige al usuario a:

```
GET /api/twitter/auth?userId=ID_DEL_USUARIO
```

Donde `ID_DEL_USUARIO` es un identificador único para el usuario en tu sistema.

#### Verificar Estado de Autorización

Para verificar si un usuario está autorizado:

```
GET /api/twitter/status?userId=ID_DEL_USUARIO
```

Respuesta:
```json
{
  "authorized": true|false,
  "expiresAt": "2025-03-16T03:43:13.472Z" // Fecha de expiración del token
}
```

#### Publicar un Tweet

Para publicar un tweet en nombre del usuario:

```
POST /api/twitter/tweet
Content-Type: application/json

{
  "userId": "ID_DEL_USUARIO",
  "text": "Contenido del tweet (máximo 280 caracteres)"
}
```

Respuesta exitosa:
```json
{
  "success": true,
  "data": {
    // Datos del tweet publicado
  }
}
```

### Flujo de Autorización

1. El usuario accede a `/api/twitter/auth?userId=ID_DEL_USUARIO`
2. Es redirigido a Twitter para autorizar la aplicación
3. Después de autorizar, Twitter redirecciona al usuario a la URL de callback
4. La aplicación procesa el código de autorización y obtiene los tokens de acceso
5. Los tokens se almacenan en la base de datos MongoDB asociados al ID del usuario
6. El usuario puede ahora publicar tweets a través de la API

### Solución de Problemas

#### Error: "Faltan credenciales de Twitter en la configuración"

Este error indica que las variables de entorno necesarias no están configuradas. Verifica que todas las variables mencionadas en la sección "Configuración de Variables de Entorno" estén correctamente definidas en tu archivo `.env`.

#### Error: "No se encontraron credenciales"

Este error ocurre cuando intentas publicar un tweet para un usuario que no ha completado el proceso de autorización. Asegúrate de que el usuario haya sido redirigido a la URL de autorización primero.

### Seguridad

- Los tokens de acceso se almacenan de forma segura en la base de datos.
- Se utiliza OAuth 2.0 para la autorización, siguiendo las mejores prácticas de seguridad
- Las sesiones están cifradas con el SESSION_SECRET
- Los tokens de acceso se renuevan automáticamente cuando expiran

### Limitaciones

- La API de Twitter tiene límites de tasa. Consulta la [documentación oficial](https://developer.twitter.com/en/docs/twitter-api/rate-limits) para más detalles
- Los tweets están limitados a 280 caracteres
- La aplicación debe cumplir con los [Términos de Servicio de Twitter](https://developer.twitter.com/en/developer-terms/agreement-and-policy)

## Referencias

- [Documentación oficial de la API de Twitter v2](https://developer.twitter.com/en/docs/twitter-api)
- [Guía de OAuth 2.0 para la API de Twitter](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
