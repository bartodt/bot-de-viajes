const { formatWatchTarget, formatTripType } = require('../utils/watchLabels');

const IATA_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

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

function normalizeIata(value = '') {
  return value.trim().toUpperCase();
}

function parseThreshold(value = '') {
  const normalized = value.replace(',', '.');
  const number = Number.parseFloat(normalized);
  if (Number.isNaN(number) || number <= 0) {
    return null;
  }
  return Number(number.toFixed(2));
}

function parseMonthInput(raw = '') {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  const prefixedMatch = cleaned.match(/^(?:month|mes)\s*[:=]\s*(.+)$/);
  const target = prefixedMatch ? prefixedMatch[1].trim() : cleaned;

  const direct = target.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (direct) {
    const month = Number.parseInt(direct[1], 10);
    const year = Number.parseInt(direct[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
    return null;
  }

  const nameMatch = target.match(/^([a-záéíóúñ]+)\s+(\d{4})$/i);
  if (nameMatch) {
    const monthKey = nameMatch[1];
    const month = MONTH_ALIASES[monthKey];
    const year = Number.parseInt(nameMatch[2], 10);
    if (month && month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
    return null;
  }

  const aliasNumeric = target.match(/^(\d{1,2})\s+(\d{4})$/);
  if (aliasNumeric) {
    const month = Number.parseInt(aliasNumeric[1], 10);
    const year = Number.parseInt(aliasNumeric[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
  }

  return null;
}

function isMonthToken(token = '') {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith('month') || normalized.startsWith('mes')) {
    return true;
  }
  if (/^[a-záéíóúñ]+\s+\d{4}$/i.test(normalized)) {
    return true;
  }
  if (/^\d{1,2}[\/\-]\d{4}$/.test(normalized)) {
    return true;
  }
  if (/^\d{1,2}\s+\d{4}$/.test(normalized)) {
    return true;
  }
  return false;
}

function parseRangeArgs(dateFromToken, dateToToken) {
  if (!dateFromToken || !DATE_REGEX.test(dateFromToken)) {
    throw new Error('Las fechas deben tener formato DD/MM/YYYY.');
  }

  const dateTo = dateToToken && dateToToken.length > 0 ? dateToToken : null;
  if (dateTo && !DATE_REGEX.test(dateTo)) {
    throw new Error('La fecha de regreso debe tener formato DD/MM/YYYY o podés dejarla vacía.');
  }

  return {
    date_from: dateFromToken,
    date_to: dateTo,
    mode: 'range',
    trip_type: dateTo ? 'RT' : 'OW'
  };
}

function parseMonthArgs(rest) {
  const [monthToken, maybeTrip] = rest;
  const monthInfo = parseMonthInput(monthToken);
  if (!monthInfo) {
    throw new Error('Usá month=MM/AAAA o escribí el mes y año (ej: agosto 2026).');
  }

  let tripType = 'RT';
  if (maybeTrip) {
    const normalizedTrip = maybeTrip.trim().toUpperCase();
    if (!['RT', 'OW'].includes(normalizedTrip)) {
      throw new Error('El tipo de viaje debe ser RT (ida y vuelta) u OW (solo ida).');
    }
    tripType = normalizedTrip;
  }

  return {
    date_from: null,
    date_to: null,
    mode: 'month',
    month: monthInfo.month,
    year: monthInfo.year,
    trip_type: tripType
  };
}

function parseArgs(text) {
  if (!text) {
    throw new Error('Formato inválido. Usá /watch FROM;TO;...;threshold o solo /watch para modo guiado.');
  }
  const parts = text.split(';').map((segment) => segment.trim()).filter(Boolean);

  if (parts.length < 4) {
    throw new Error('Formato inválido. Necesito al menos FROM;TO;fechas o mes;threshold.');
  }

  const thresholdStr = parts.pop();
  const threshold = parseThreshold(thresholdStr);
  if (threshold === null) {
    throw new Error('El umbral debe ser un número mayor a 0.');
  }

  const [fromRaw, toRaw, ...rest] = parts;
  if (!fromRaw || !toRaw || rest.length === 0) {
    throw new Error('Faltan datos. Recuerda: FROM;TO;fechas/mes;threshold.');
  }

  const from = normalizeIata(fromRaw);
  const to = normalizeIata(toRaw);

  if (!IATA_REGEX.test(from) || !IATA_REGEX.test(to)) {
    throw new Error('Los códigos IATA deben tener exactamente 3 letras (ej: EZE, BCN).');
  }

  const monthCandidate = rest[0];
  const monthMode = isMonthToken(monthCandidate);
  let parsedDates;
  if (monthMode) {
    if (rest.length > 2) {
      throw new Error('Para mes completo utilizá: FROM;TO;month=MM/AAAA;[RT|OW];threshold');
    }
    parsedDates = parseMonthArgs(rest);
  } else {
    if (rest.length > 2) {
      throw new Error('Formato inválido. Para fechas puntuales usá: FROM;TO;SALIDA;REGRESO opcional;threshold');
    }
    parsedDates = parseRangeArgs(rest[0], rest[1]);
  }

  return {
    from,
    to,
    ...parsedDates,
    threshold_usd: threshold
  };
}

function createWatchCommand({ bot, store, flow }) {
  return async (msg, match) => {
    const chatId = msg.chat.id;
    const rawArgs = match && match[1] ? match[1].trim() : '';

    if (!rawArgs) {
      if (flow && flow.isActive(chatId)) {
        await bot.sendMessage(chatId, 'Ya estamos creando un seguimiento. Respondé las preguntas anteriores o enviá /cancel.');
        return;
      }
      if (flow) {
        await flow.start(chatId);
        return;
      }
      await bot.sendMessage(chatId, 'Formato: /watch FROM;TO;DD/MM/YYYY;DD/MM/YYYY opcional;threshold');
      return;
    }

    try {
      const args = parseArgs(rawArgs);
      const watch = await store.add(args);
      const dateSegment = formatWatchTarget(watch);
      const tripTypeLabel = formatTripType(watch);
      const confirmation = [
        `Watch #${watch.id} creado correctamente.`,
        `${watch.from} → ${watch.to} | ${dateSegment}`,
        `Tipo: ${tripTypeLabel}`,
        `Umbral USD ${watch.threshold_usd}`
      ].join('\n');
      await bot.sendMessage(msg.chat.id, confirmation);
    } catch (error) {
      await bot.sendMessage(msg.chat.id, `❌ ${error.message}`);
    }
  };
}

module.exports = {
  createWatchCommand
};
