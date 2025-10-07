const { formatWatchTarget, formatTripType } = require('./utils/watchLabels');

function formatUsd(value) {
  return Number.isFinite(value) ? `USD ${value}` : 'N/D';
}

function createNotifier(bot, config) {
  const ownerChatId = String(config.OWNER_CHAT_ID);
  const quietMillis = config.QUIET_MIN * 60 * 1000;
  const timeFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: config.TZ,
    hour: '2-digit',
    minute: '2-digit'
  });

  function buildMessage(watch, result, timestamp, context = {}) {
    const nowLabel = timeFormatter.format(timestamp);
    const targetLabel = formatWatchTarget(watch);
    const tripTypeLabel = formatTripType(watch);
    const { previousPrice, triggeredByDrop, triggeredByThreshold } = context;
    const lines = [
      '✈️ Oferta detectada',
      `${watch.from} → ${watch.to} | ${targetLabel}`,
      `Tipo: ${tripTypeLabel}`,
      `Precio: ${formatUsd(result.priceUsd)}`
    ];

    if (Number.isFinite(previousPrice)) {
      const delta = previousPrice - result.priceUsd;
      const deltaSymbol = delta > 0 ? '↓' : delta < 0 ? '↑' : '→';
      const deltaValue = Number.isFinite(delta) ? ` (${deltaSymbol}${Math.abs(delta)})` : '';
      lines.push(`Anterior: ${formatUsd(previousPrice)}${deltaValue}`);
    }

    if (Number.isFinite(watch.threshold_usd)) {
      const label = triggeredByThreshold ? 'Umbral alcanzado' : 'Umbral';
      lines.push(`${label}: USD ${watch.threshold_usd}`);
    }

    if (result.travelDate) {
      lines.push(`Mejor fecha detectada: ${result.travelDate}`);
    }

    if (triggeredByDrop && !triggeredByThreshold) {
      lines.push('Motivo: precio más bajo que el anterior.');
    }

    lines.push(`Fuente: ${result.provider}`);
    lines.push(`(#watch ${watch.id} • ${nowLabel})`);

    return lines.join('\n');
  }

  async function maybeNotify(watch, result, timestamp, context = {}) {
    if (!result || typeof result.priceUsd !== 'number') {
      return { notified: false };
    }
    const previousPrice = context.previousPrice;
    const threshold = watch.threshold_usd;
    const hasThreshold = Number.isFinite(threshold);
    const triggeredByThreshold = hasThreshold && result.priceUsd <= threshold;
    const triggeredByDrop = Number.isFinite(previousPrice) && result.priceUsd < previousPrice;

    if (!triggeredByThreshold && !triggeredByDrop) {
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

    const message = buildMessage(watch, result, timestamp, {
      previousPrice,
      triggeredByDrop,
      triggeredByThreshold
    });
    await bot.sendMessage(ownerChatId, message, {
      disable_web_page_preview: true
    });

    return { notified: true, message, triggeredByDrop, triggeredByThreshold };
  }

  return {
    maybeNotify,
    buildMessage
  };
}

module.exports = {
  createNotifier
};
