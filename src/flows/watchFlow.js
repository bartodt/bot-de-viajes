const { formatWatchTarget, formatTripType } = require('../utils/watchLabels');

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

function isAffirmative(input = '') {
  return /^(s[ií]|si|sí|yes|y|true)$/i.test(input.trim());
}

function isNegative(input = '') {
  return /^(no|n|false)$/i.test(input.trim());
}

const MONTH_ALIASES = {
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12
};

function parseMonthInput(raw = '') {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  const directMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (directMatch) {
    const month = Number.parseInt(directMatch[1], 10);
    const year = Number.parseInt(directMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
    return null;
  }

  const nameMatch = cleaned.match(/^([a-záéíóúñ]+)\s+(\d{4})$/i);
  if (!nameMatch) {
    return null;
  }

  const monthKey = nameMatch[1];
  const month = MONTH_ALIASES[monthKey];
  const year = Number.parseInt(nameMatch[2], 10);
  if (!month || month < 1 || month > 12 || year < 2000) {
    return null;
  }

  return { month, year };
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
        session.step = 'mode';
        await bot.sendMessage(
          chatId,
          '¿Querés vigilar un mes completo? Respondé "sí" para mes completo o "no" para una fecha puntual.'
        );
        return true;
      }
      case 'mode': {
        if (!isAffirmative(trimmed) && !isNegative(trimmed)) {
          await bot.sendMessage(chatId, 'Respondé "sí" o "no", por favor.');
          return true;
        }
        if (isAffirmative(trimmed)) {
          data.mode = 'month';
          session.step = 'month';
          await bot.sendMessage(chatId, 'Indicá el mes y año (MM/AAAA o "marzo 2026").');
          return true;
        }
        data.mode = 'range';
        session.step = 'date_from';
        await bot.sendMessage(chatId, '¿Cuál es la fecha de salida? (DD/MM/AAAA)');
        return true;
      }
      case 'month': {
        const monthInfo = parseMonthInput(trimmed);
        if (!monthInfo) {
          await bot.sendMessage(chatId, 'Formato inválido. Usá MM/AAAA o escribí el mes seguido del año (ej: "marzo 2026").');
          return true;
        }
        data.month = monthInfo.month;
        data.year = monthInfo.year;
        session.step = 'trip_type';
        await bot.sendMessage(chatId, '¿Buscás ida y vuelta? Respondé "sí" o "no".');
        return true;
      }
      case 'trip_type': {
        if (!isAffirmative(trimmed) && !isNegative(trimmed)) {
          await bot.sendMessage(chatId, 'Respondé "sí" o "no", por favor.');
          return true;
        }
        data.trip_type = isAffirmative(trimmed) ? 'RT' : 'OW';
        session.step = 'threshold';
        await bot.sendMessage(chatId, '¿Cuál es el precio máximo en USD que querés vigilar?');
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
        data.trip_type = data.date_to ? 'RT' : 'OW';
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
      mode: payload.mode === 'month' ? 'month' : 'range',
      date_from: payload.mode === 'month' ? null : payload.date_from,
      date_to: payload.mode === 'month' ? null : payload.date_to,
      month: payload.mode === 'month' ? payload.month : null,
      year: payload.mode === 'month' ? payload.year : null,
      trip_type: payload.trip_type,
      threshold_usd: payload.threshold_usd
    });

    const dateSegment = formatWatchTarget(watch);
    const tripTypeLabel = formatTripType(watch);
    const message = [
      `Watch #${watch.id} creado ✅`,
      `${watch.from} → ${watch.to} | ${dateSegment}`,
      `Tipo: ${tripTypeLabel}`,
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
