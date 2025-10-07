const IATA_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function parseArgs(text) {
  if (!text) {
    throw new Error('Formato inválido. Usá /watch FROM;TO;DD/MM/YYYY;DD/MM/YYYY opcional;threshold o solo /watch para modo guiado.');
  }
  const parts = text.split(';').map((segment) => segment.trim());

  if (parts.length < 4 || parts.length > 5) {
    throw new Error('Formato inválido. Usá /watch FROM;TO;DD/MM/YYYY;DD/MM/YYYY opcional;threshold o solo /watch para modo guiado.');
  }

  let from;
  let to;
  let dateFrom;
  let dateTo;
  let thresholdStr;

  if (parts.length === 4) {
    [from, to, dateFrom, thresholdStr] = parts;
    dateTo = '';
  } else {
    [from, to, dateFrom, dateTo, thresholdStr] = parts;
  }

  if (!from || !to || !dateFrom || !thresholdStr) {
    throw new Error('Todos los campos son obligatorios salvo date_to.');
  }

  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();

  if (!IATA_REGEX.test(normalizedFrom) || !IATA_REGEX.test(normalizedTo)) {
    throw new Error('Los códigos IATA deben tener exactamente 3 letras (ej: EZE, BCN).');
  }

  if (!DATE_REGEX.test(dateFrom)) {
    throw new Error('Las fechas deben tener formato DD/MM/YYYY.');
  }

  const sanitizedDateTo = dateTo && dateTo.length > 0 ? dateTo : null;
  if (sanitizedDateTo && !DATE_REGEX.test(sanitizedDateTo)) {
    throw new Error('La fecha de regreso debe tener formato DD/MM/YYYY.');
  }

  const threshold = Number.parseFloat(thresholdStr);
  if (Number.isNaN(threshold) || threshold <= 0) {
    throw new Error('El umbral debe ser un número mayor a 0.');
  }

  return {
    from: normalizedFrom,
    to: normalizedTo,
    date_from: dateFrom,
    date_to: sanitizedDateTo,
    threshold_usd: Number(threshold.toFixed(2))
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
      const dateSegment = watch.date_to
        ? `${watch.date_from} → ${watch.date_to}`
        : watch.date_from;
      const confirmation = [
        `Watch #${watch.id} creado correctamente.`,
        `${watch.from} → ${watch.to} | ${dateSegment}`,
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
