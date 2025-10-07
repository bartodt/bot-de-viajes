const TelegramBot = require('node-telegram-bot-api');
const { createStartCommand } = require('./commands/start');
const { createWatchCommand } = require('./commands/watch');
const { createListCommand } = require('./commands/list');
const { createRemoveCommand } = require('./commands/remove');
const { createCheckCommand } = require('./commands/check');

function createBot(config) {
  return new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
}

function registerHandlers({ bot, config, store, scheduler }) {
  const ownerChatId = String(config.OWNER_CHAT_ID);

  const startCommand = createStartCommand({ bot, config, store });
  const watchCommand = createWatchCommand({ bot, config, store });
  const listCommand = createListCommand({ bot, config, store });
  const removeCommand = createRemoveCommand({ bot, config, store });
  const checkCommand = createCheckCommand({ bot, config, scheduler });

  function guard(handler) {
    return async (msg, ...args) => {
      if (String(msg.chat.id) !== ownerChatId) {
        return;
      }
      await handler(msg, ...args);
    };
  }

  bot.on('message', async (msg) => {
    if (String(msg.chat.id) !== ownerChatId) {
      await bot.sendMessage(msg.chat.id, 'No autorizado');
    }
  });

  bot.onText(/^\/start\b/i, guard(startCommand));
  bot.onText(/^\/watch(?:\s+(.+))?$/i, guard(watchCommand));
  bot.onText(/^\/list\b/i, guard(listCommand));
  bot.onText(/^\/remove\s+(.+)$/i, guard(removeCommand));
  bot.onText(/^\/check\b/i, guard(checkCommand));
}

module.exports = {
  createBot,
  registerHandlers
};
