function createStartCommand({ bot }) {
  return async (msg) => {
    const helpMessage = [
      'Bienvenido al bot de alertas de vuelos ✈️',
      'Comandos disponibles:',
      '/watch EZE;BCN;15/02/2026;28/02/2026;700',
      '/list',
      '/remove <id>',
      '/check'
    ].join('\n');

    await bot.sendMessage(msg.chat.id, helpMessage);
  };
}

module.exports = {
  createStartCommand
};
