function createCheckCommand({ bot, scheduler }) {
  return async (msg) => {
    try {
      const summary = await scheduler.runOnce();
      const { processed = 0, alerts = 0, errors = [] } = summary || {};

      const baseMessage = `Chequeo manual completado.\nWatches procesados: ${processed}\nAlertas enviadas: ${alerts}`;
      if (errors.length === 0) {
        await bot.sendMessage(msg.chat.id, baseMessage);
        return;
      }

      const errorLines = errors
        .slice(0, 5)
        .map((err) => `#${err.watchId}: ${err.message}`);
      const suffix = errors.length > 5 ? '\n... (ver logs para más detalles)' : '';
      await bot.sendMessage(msg.chat.id, `${baseMessage}\nErrores:\n${errorLines.join('\n')}${suffix}`);
    } catch (error) {
      await bot.sendMessage(msg.chat.id, `Falló el chequeo: ${error.message}`);
    }
  };
}

module.exports = {
  createCheckCommand
};
