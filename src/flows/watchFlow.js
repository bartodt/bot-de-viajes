const IATA_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function normalizeIata(value = '') {
  return value.trim().toUpperCase();
}

function isValidIata(value) {
  return IATA_REGEX.test(normalizeIata(value));
}

function isValidDate(value = '') {
  return DATE_REGEX.test(value.trim());
}

function parseThreshold(value = '') {
  const number = Number.parseFloat(value.replace(',', '.'));
  if (Number.isNaN(number) || number <= 0) {
    return null;
  }
  return Number(number.toFixed(2));
}

function createWatchFlow({ bot, store }) {
  const sessions = new Map();

  function getSession(chatId) {
    return sessions.get(chatId);
  }

  function resetSession(chatId) {
    sessions.delete(chatId);
  }

  async function start(chatId) {
    sessions.set(chatId, { step: 'from', data: {} });
    await bot.sendMessage(
      chatId,
      'Vamos a crear un nuevo seguimiento 🧭\n¿Desde qué aeropuerto (IATA, ej: EZE) querés salir?'
    );
  }

  async function handleMessage(chatId, text) {
    const session = getSession(chatId);
    if (!session) {
      return false;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      await bot.sendMessage(chatId, 'Necesito un valor. Probá nuevamente.');
      return true;
    }

    const data = session.data;

    switch (session.step) {
      case 'from': {
        if (!isValidIata(trimmed)) {
          await bot.sendMessage(chatId, 'El código IATA debe ser de 3 letras (ej: EZE). Intentá de nuevo.');
          return true;
        }
        data.from = normalizeIata(trimmed);
        session.step = 'to';
        await bot.sendMessage(chatId, '¿A qué aeropuerto (IATA) querés viajar?');
        return true;
      }
      case 'to': {
        if (!isValidIata(trimmed)) {
          await bot.sendMessage(chatId, 'El código IATA debe ser de 3 letras (ej: BCN). Intentá de nuevo.');
          return true;
        }
        data.to = normalizeIata(trimmed);
        session.step = 'date_from';
        await bot.sendMessage(chatId, '¿Cuál es la fecha de salida? (DD/MM/AAAA)');
        return true;
      }
      case 'date_from': {
        if (!isValidDate(trimmed)) {
          await bot.sendMessage(chatId, 'La fecha debe tener formato DD/MM/AAAA. Ejemplo: 15/10/2025');
          return true;
        }
        data.date_from = trimmed;
        session.step = 'date_to';
        await bot.sendMessage(chatId, "¿Tenés fecha de regreso? Indicá DD/MM/AAAA o respondé 'no'.");
        return true;
      }
      case 'date_to': {
        if (/^no$/i.test(trimmed)) {
          data.date_to = null;
        } else {
          if (!isValidDate(trimmed)) {
            await bot.sendMessage(chatId, 'La fecha debe tener formato DD/MM/AAAA o respondé "no" si no tenés regreso.');
            return true;
          }
          data.date_to = trimmed;
        }
        session.step = 'threshold';
        await bot.sendMessage(chatId, '¿Cuál es el precio máximo en USD que querés vigilar?');
        return true;
      }
      case 'threshold': {
        const threshold = parseThreshold(trimmed);
        if (threshold === null) {
          await bot.sendMessage(chatId, 'El umbral debe ser un número mayor a 0. Ejemplo: 750');
          return true;
        }
        data.threshold_usd = threshold;
        await finalize(chatId, data);
        resetSession(chatId);
        return true;
      }
      default:
        resetSession(chatId);
        return false;
    }
  }

  async function finalize(chatId, payload) {
    const watch = await store.add({
      from: payload.from,
      to: payload.to,
      date_from: payload.date_from,
      date_to: payload.date_to,
      threshold_usd: payload.threshold_usd
    });

    const dateSegment = watch.date_to ? `${watch.date_from} → ${watch.date_to}` : watch.date_from;
    const message = [
      `Watch #${watch.id} creado ✅`,
      `${watch.from} → ${watch.to} | ${dateSegment}`,
      `Umbral: USD ${watch.threshold_usd}`,
      'Usá /check para forzar una búsqueda cuando quieras.'
    ].join('\n');

    await bot.sendMessage(chatId, message);
  }

  async function cancel(chatId) {
    if (sessions.has(chatId)) {
      sessions.delete(chatId);
      await bot.sendMessage(chatId, 'Se canceló el proceso. Podés empezar de nuevo con /watch.');
      return true;
    }
    await bot.sendMessage(chatId, 'No hay ningún proceso en curso.');
    return false;
  }

  function isActive(chatId) {
    return sessions.has(chatId);
  }

  return {
    start,
    handleMessage,
    cancel,
    isActive
  };
}

module.exports = {
  createWatchFlow
};
