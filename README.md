# Bot de viajes ✈️

Bot de Telegram (Node.js 20) para monitorear precios reales de vuelos consultando el calendario público de Level. Pensado para un único usuario autenticado por `chat_id`.

## Requisitos previos
- Node.js 20+ y npm.
- Cuenta de Telegram para crear un bot vía [BotFather](https://core.telegram.org/bots#6-botfather).

## Configuración
1. Crea un bot con BotFather y obtené el `TELEGRAM_TOKEN`.
2. Inicia una conversación con tu bot y usa `https://api.telegram.org/bot<TELEGRAM_TOKEN>/getUpdates` para leer tu `chat.id` → `OWNER_CHAT_ID`.
3. Copiá `.env.example` a `.env` y completá los valores:
   ```ini
   TELEGRAM_TOKEN=123456789:example
   OWNER_CHAT_ID=123456789
   CHECK_INTERVAL_MIN=30
   QUIET_MIN=60
   FLEX_DAYS=0
   HTTP_TIMEOUT_MS=8000
   TZ=America/Argentina/Buenos_Aires
   ```

## Ejecución local
```bash
npm install
npm start
```
El bot inicia en modo polling y crea `data/watches.json` si no existe.

-## Comandos disponibles
- `/start` – ayuda rápida.
- `/watch` – inicia un asistente paso a paso (pedirá origen, destino, fechas y umbral).
- `/watch <from>;<to>;<date_from>;<date_to opcional>;<threshold_usd>`  
  Ejemplo: `/watch EZE;LIS;10/10/2025;20/10/2025;800`
- `/list` – lista los watches con el último precio observado.
- `/remove <id>` – elimina un watch.
- `/check` – fuerza un chequeo inmediato contra el calendario de Level.
- `/cancel` – cancela el asistente actual.
- También podés escribir algo como “quiero monitorear un vuelo” y el bot te guiará automáticamente.

Solo el `OWNER_CHAT_ID` recibe respuestas; otros chats verán “No autorizado”.

## Cómo funciona
- Los watches se guardan en `data/watches.json` de forma atómica.
- Cada `CHECK_INTERVAL_MIN` minutos (cron via node-cron, recomendado 30) se consulta `https://www.flylevel.com/nwe/api/pricing/calendar/` pasando `triptype`, `origin`, `destination`, `outboundDate` (YYYYMMDD) y la combinación `month/year` correspondiente para reunir los precios diarios dentro del rango solicitado.
- Si el mejor precio baja frente al último visto o queda por debajo de `threshold_usd`, y pasó el período de silencio (`QUIET_MIN` minutos), se envía una alerta:
  ```
  ✈️ Oferta detectada
  EZE → LIS | 10/10/2025 → 20/10/2025
  Precio: USD 688
  Anterior: USD 742 (↓54)
  Umbral: USD 700
  Fuente: Level
  Link: https://...
  (#watch 3 • 10:42)
  ```
- Maneja timeouts (`HTTP_TIMEOUT_MS`) y reintentos simples frente a errores de red/5xx.

## Docker
Construí y levantá con:
```bash
docker compose up --build
```
El servicio monta `./data` en el contenedor para persistir los watches. Asegurate de tener `.env` en la raíz.

## Variables de entorno
- `TELEGRAM_TOKEN` *(obligatoria)* – token de BotFather.
- `OWNER_CHAT_ID` *(obligatoria)* – chat autorizado.
- `CHECK_INTERVAL_MIN` – intervalo de cron en minutos (default 30).
- `QUIET_MIN` – ventana anti-spam en minutos (default 60).
- `FLEX_DAYS` – rango ± en días cuando no se especifica `date_to` (default 0).
- `HTTP_TIMEOUT_MS` – timeout HTTP para las peticiones a Level (default 8000).
- `TZ` – zona horaria usada en cron y mensajes (default `America/Argentina/Buenos_Aires`).

## Notas
- El calendario público de Level no requiere autenticación ni sesión; usalo de forma responsable.
- El repositorio no incluye credenciales ni información sensible.
- Ejecutá `/check` después de crear un watch para validar que todo funcione.
