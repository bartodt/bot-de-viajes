const TelegramBot = require('node-telegram-bot-api');
const { createStartCommand } = require('./commands/start');
const { createWatchCommand } = require('./commands/watch');
const { createListCommand } = require('./commands/list');
const { createRemoveCommand } = require('./commands/remove');
const { createCheckCommand } = require('./commands/check');
const { createCancelCommand } = require('./commands/cancel');

function createBot(config) {
  return new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
}

function registerHandlers({ bot, config, store, scheduler, watchFlow }) {
  const ownerChatId = String(config.OWNER_CHAT_ID);

  const startCommand = createStartCommand({ bot, config, store });
  const watchCommand = createWatchCommand({ bot, config, store, flow: watchFlow });
  const listCommand = createListCommand({ bot, config, store });
  const removeCommand = createRemoveCommand({ bot, config, store });
  const checkCommand = createCheckCommand({ bot, config, scheduler });
  const cancelCommand = createCancelCommand({ bot, watchFlow });

  function guard(handler) {
    return async (msg, ...args) => {
      if (String(msg.chat.id) !== ownerChatId) {
        return;
      }
      await handler(msg, ...args);
    };
  }

  bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);

    if (chatId !== ownerChatId) {
      await bot.sendMessage(msg.chat.id, 'No autorizado');
      return;
    }

    const text = msg.text || '';
    if (!text) {
      return;
    }
    if (text.startsWith('/')) {
      return;
    }

    if (watchFlow) {
      const handled = await watchFlow.handleMessage(msg.chat.id, text);
      if (handled) {
        return;
      }

      const normalized = text.trim().toLowerCase();
      if (
        !watchFlow.isActive(msg.chat.id) &&
        /(nuevo|seguir|monitorear|vigilar).*(vuelo|viaje)/.test(normalized)
      ) {
        await watchFlow.start(msg.chat.id);
      }
    }
  });

  bot.onText(/^\/start\b/i, guard(startCommand));
  bot.onText(/^\/watch(?:\s+(.+))?$/i, guard(watchCommand));
  bot.onText(/^\/list\b/i, guard(listCommand));
  bot.onText(/^\/remove\s+(.+)$/i, guard(removeCommand));
  bot.onText(/^\/check\b/i, guard(checkCommand));
  bot.onText(/^\/cancel\b/i, guard(cancelCommand));
}

module.exports = {
  createBot,
  registerHandlers
};
