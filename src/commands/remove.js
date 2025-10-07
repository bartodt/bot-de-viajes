function createRemoveCommand({ bot, store }) {
  return async (msg, match) => {
    const idStr = match && match[1] ? match[1].trim() : '';
    const id = Number.parseInt(idStr, 10);
    if (Number.isNaN(id) || id <= 0) {
      await bot.sendMessage(msg.chat.id, 'Debes indicar un ID válido. Ejemplo: /remove 3');
      return;
    }

    const removed = await store.remove(id);
    if (!removed) {
      await bot.sendMessage(msg.chat.id, `No encontré el watch #${id}.`);
      return;
    }

    await bot.sendMessage(msg.chat.id, `Watch #${id} eliminado.`);
  };
}

module.exports = {
  createRemoveCommand
};
