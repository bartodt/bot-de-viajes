# Bot de viajes ✈️

Bot de Telegram (Node.js 20) para monitorear precios reales de vuelos con la API oficial Kiwi/Tequila. Pensado para un único usuario autenticado por `chat_id`.

## Requisitos previos
- Node.js 20+ y npm.
- Cuenta de Telegram para crear un bot vía [BotFather](https://core.telegram.org/bots#6-botfather).
- Token de la API [Kiwi Tequila](https://tequila.kiwi.com/portal/docs/tequila_api).

## Configuración
1. Crea un bot con BotFather y obtené el `TELEGRAM_TOKEN`.
2. Inicia una conversación con tu bot y usa `https://api.telegram.org/bot<TELEGRAM_TOKEN>/getUpdates` para leer tu `chat.id` → `OWNER_CHAT_ID`.
3. Genera un API key en el panel de Tequila.
4. Copiá `.env.example` a `.env` y completá los valores:
   ```ini
   TELEGRAM_TOKEN=123456789:example
   OWNER_CHAT_ID=123456789
   TEQUILA_API_KEY=tu_clave
   CHECK_INTERVAL_MIN=10
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

## Comandos disponibles
- `/start` – ayuda rápida.
- `/watch <from>;<to>;<date_from>;<date_to opcional>;<threshold_usd>`  
  Ejemplo: `/watch EZE;BCN;15/02/2026;28/02/2026;700`
- `/list` – lista los watches con el último precio observado.
- `/remove <id>` – elimina un watch.
- `/check` – fuerza un chequeo inmediato contra la API de Tequila.

Solo el `OWNER_CHAT_ID` recibe respuestas; otros chats verán “No autorizado”.

## Cómo funciona
- Los watches se guardan en `data/watches.json` de forma atómica.
- Cada `CHECK_INTERVAL_MIN` minutos (cron via node-cron) se consulta Tequila:  
  `https://tequila-api.kiwi.com/v2/search` con `curr=USD`, `limit=5`, `sort=price`.
- Si el mejor precio ≤ `threshold_usd` y pasó el período de silencio (`QUIET_MIN` minutos), se envía una alerta:
  ```
  ✈️ Oferta detectada
  EZE → BCN | 15/02/2026 → 28/02/2026
  Precio: USD 642 (umbral: 700)
  Fuente: Kiwi
  Link: https://...
  (#watch 3 • 10:42)
  ```
- Maneja timeouts (`HTTP_TIMEOUT_MS`) y reintentos simples frente a 429/5xx.

## Docker
Construí y levantá con:
```bash
docker compose up --build
```
El servicio monta `./data` en el contenedor para persistir los watches. Asegurate de tener `.env` en la raíz.

## Variables de entorno
- `TELEGRAM_TOKEN` *(obligatoria)* – token de BotFather.
- `OWNER_CHAT_ID` *(obligatoria)* – chat autorizado.
- `TEQUILA_API_KEY` *(obligatoria)* – key de Kiwi/Tequila.
- `CHECK_INTERVAL_MIN` – intervalo de cron en minutos (default 10).
- `QUIET_MIN` – ventana anti-spam en minutos (default 60).
- `FLEX_DAYS` – rango ± en días cuando no se especifica `date_to` (default 0).
- `HTTP_TIMEOUT_MS` – timeout HTTP para Tequila (default 8000).
- `TZ` – zona horaria usada en cron y mensajes (default `America/Argentina/Buenos_Aires`).

## Notas
- Usa únicamente la API oficial de Kiwi/Tequila respetando sus Términos.
- El repositorio no incluye tu clave ni credenciales.
- Ejecutá `/check` después de crear un watch para validar que todo funcione.
