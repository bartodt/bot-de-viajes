function createNotifier(bot, config) {
  const ownerChatId = String(config.OWNER_CHAT_ID);
  const quietMillis = config.QUIET_MIN * 60 * 1000;
  const timeFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: config.TZ,
    hour: '2-digit',
    minute: '2-digit'
  });

  function buildMessage(watch, result, timestamp) {
    const nowLabel = timeFormatter.format(timestamp);
    const dateSegment = watch.date_to ? `${watch.date_from} → ${watch.date_to}` : watch.date_from;

    return [
      '✈️ Oferta detectada',
      `${watch.from} → ${watch.to} | ${dateSegment}`,
      `Precio: USD ${result.priceUsd} (umbral: ${watch.threshold_usd})`,
      `Fuente: ${result.provider}`,
      `Link: ${result.deepLink || 'No disponible'}`,
      `(#watch ${watch.id} • ${nowLabel})`
    ].join('\n');
  }

  async function maybeNotify(watch, result, timestamp) {
    if (!result || typeof result.priceUsd !== 'number') {
      return { notified: false };
    }
    if (result.priceUsd > watch.threshold_usd) {
      return { notified: false };
    }
    if (watch.lastAlertAt) {
      const lastAlert = new Date(watch.lastAlertAt);
      if (!Number.isNaN(lastAlert.getTime())) {
        const delta = timestamp.getTime() - lastAlert.getTime();
        if (delta < quietMillis) {
          return { notified: false, reason: 'quiet_period' };
        }
      }
    }

    const message = buildMessage(watch, result, timestamp);
    await bot.sendMessage(ownerChatId, message, {
      disable_web_page_preview: true
    });

    return { notified: true, message };
  }

  return {
    maybeNotify,
    buildMessage
  };
}

module.exports = {
  createNotifier
};
