function createCancelCommand({ bot, watchFlow }) {
  return async (msg) => {
    await watchFlow.cancel(msg.chat.id);
  };
}

module.exports = {
  createCancelCommand
};
