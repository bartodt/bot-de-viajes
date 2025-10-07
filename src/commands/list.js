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
      const dateSegment = watch.date_to ? `${watch.date_from} → ${watch.date_to}` : watch.date_from;

      const lastSeen = watch.lastSeenAt
        ? `${watch.lastSeenPrice !== null ? `USD ${watch.lastSeenPrice}` : 'Sin precio'} @ ${dateTimeFormatter.format(new Date(watch.lastSeenAt))}`
        : 'Sin chequeos todavía';

      return [
        `#${watch.id} ${watch.from} → ${watch.to} | ${dateSegment}`,
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
