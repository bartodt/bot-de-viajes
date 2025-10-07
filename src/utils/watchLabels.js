const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

function formatMonthName(monthNumber) {
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
    return '';
  }
  return MONTH_NAMES[monthNumber - 1];
}

function formatTripType(watch) {
  const tripType = (watch && watch.trip_type) || (watch && watch.date_to ? 'RT' : 'OW');
  return tripType === 'RT' ? 'ida y vuelta' : 'solo ida';
}

function formatWatchTarget(watch) {
  const mode = watch?.mode || 'range';
  if (mode === 'month') {
    const monthName = formatMonthName(watch.month);
    const year = watch.year || '';
    const tripTypeLabel = formatTripType(watch);
    if (monthName) {
      return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year} (mes completo, ${tripTypeLabel})`;
    }
    return `Mes ${watch.month}/${year} (mes completo, ${tripTypeLabel})`;
  }

  const from = watch?.date_from;
  const to = watch?.date_to;
  if (from && to) {
    return `${from} → ${to}`;
  }
  if (from) {
    return from;
  }
  return 'sin fecha definida';
}

module.exports = {
  formatMonthName,
  formatTripType,
  formatWatchTarget
};
