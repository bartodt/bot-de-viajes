function createStartCommand({ bot }) {
  return async (msg) => {
    const helpMessage = [
      'Bienvenido al bot de alertas de vuelos ✈️',
      'Podés crear un seguimiento con /watch y seguir el asistente paso a paso.',
      'Comandos disponibles:',
      '/watch EZE;BCN;15/02/2026;28/02/2026;700',
      '/list',
      '/remove <id>',
      '/check',
      '/cancel'
    ].join('\n');

    await bot.sendMessage(msg.chat.id, helpMessage);
  };
}

module.exports = {
  createStartCommand
};
