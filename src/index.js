const config = require('./config');
const WatchStore = require('./store');
const { createBot, registerHandlers } = require('./telegram');
const { createNotifier } = require('./notifier');
const { createScheduler } = require('./scheduler');
const { createWatchFlow } = require('./flows/watchFlow');

async function main() {
  const store = new WatchStore(config.DATA_FILE);
  await store.init();

  const bot = createBot(config);
  const watchFlow = createWatchFlow({ bot, store });
  const notifier = createNotifier(bot, config);
  const scheduler = createScheduler({ store, notifier, appConfig: config });

  registerHandlers({ bot, config, store, scheduler, watchFlow });

  bot.on('polling_error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[telegram] Polling error:', error.message);
  });

  scheduler.start();

  // eslint-disable-next-line no-console
  console.log('Bot de viajes listo. Cron activo cada', config.CHECK_INTERVAL_MIN, 'minutos.');

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('Cerrando bot...');
    scheduler.stop();
    try {
      await bot.stopPolling();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error al detener el bot de Telegram:', error.message);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('No se pudo iniciar el bot:', error);
  process.exit(1);
});
