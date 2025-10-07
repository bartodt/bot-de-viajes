const { formatWatchTarget, formatTripType } = require('../utils/watchLabels');

function createListCommand({ bot, store, config }) {
  const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: config.TZ,
    dateStyle: 'short',
    timeStyle: 'short'
  });

  return async (msg) => {
    const watches = await store.getAll();
    if (watches.length === 0) {
      await bot.sendMessage(msg.chat.id, 'No hay watches configurados.');
      return;
    }

    const lines = watches.map((watch) => {
      const target = formatWatchTarget(watch);
      const tripTypeLabel = formatTripType(watch);

      let lastSeen;
      if (watch.lastSeenAt) {
        const parts = [];
        if (watch.lastSeenPrice !== null) {
          parts.push(`USD ${watch.lastSeenPrice}`);
        } else {
          parts.push('Sin precio');
        }
        if (watch.lastSeenTravelDate) {
          parts.push(`Fecha ${watch.lastSeenTravelDate}`);
        }
        parts.push(`@ ${dateTimeFormatter.format(new Date(watch.lastSeenAt))}`);
        lastSeen = parts.join(' | ');
      } else {
        lastSeen = 'Sin chequeos todavía';
      }

      return [
        `#${watch.id} ${watch.from} → ${watch.to} | ${target}`,
        `Tipo: ${tripTypeLabel}`,
        `Umbral: USD ${watch.threshold_usd}`,
        `Último: ${lastSeen}`
      ].join('\n');
    });

    await bot.sendMessage(msg.chat.id, lines.join('\n\n'));
  };
}

module.exports = {
  createListCommand
};
