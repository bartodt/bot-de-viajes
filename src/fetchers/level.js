const axios = require('axios');
const {
  HTTP_TIMEOUT_MS,
  FLEX_DAYS
} = require('../config');

const BASE_URL = 'https://www.flylevel.com';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [300, 900, 1800];

const client = axios.create({
  baseURL: BASE_URL,
  timeout: HTTP_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'bot-de-viajes/1.0 (+https://www.flylevel.com)'
  }
});

function parseDate(input) {
  if (!input) {
    return null;
  }
  const [day, month, year] = input.split('/').map(Number);
  if ([day, month, year].some((value) => Number.isNaN(value))) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function toDdMmYyyy(date) {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toCompactDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function addDays(date, amount) {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + amount);
  return cloned;
}

function buildDateRange({ date_from, date_to }) {
  const start = parseDate(date_from);
  if (!start) {
    throw new Error('Fecha de salida inválida');
  }
  let end;
  if (date_to) {
    end = parseDate(date_to);
    if (!end) {
      throw new Error('Fecha de regreso inválida');
    }
  } else if (FLEX_DAYS > 0) {
    end = addDays(start, FLEX_DAYS);
    return {
      from: addDays(start, -FLEX_DAYS),
      to: end
    };
  } else {
    end = start;
  }
  if (end < start) {
    throw new Error('La fecha de regreso debe ser posterior a la de salida');
  }
  return { from: start, to: end };
}

function enumerateMonths(startDate, endDate) {
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= last) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function shouldRetry(error) {
  if (error.response) {
    const { status } = error.response;
    return status >= 500 && status < 600;
  }
  return error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDeepLink({ origin, destination, tripType, departureDate, returnDate }) {
  const url = new URL('/en/booking/', BASE_URL);
  url.searchParams.set('tripType', tripType);
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  if (departureDate) {
    url.searchParams.set('departureDate', departureDate);
  }
  if (tripType === 'RT' && returnDate) {
    url.searchParams.set('returnDate', returnDate);
  }
  url.searchParams.set('adults', '1');
  return url.toString();
}

async function fetchMonthPrices(params) {
  const sanitizedParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.get('/nwe/api/pricing/calendar/', { params: sanitizedParams });
      return Array.isArray(response.data?.dayPrices) ? response.data.dayPrices : [];
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS - 1 || !shouldRetry(error)) {
        throw error;
      }
      await delay(RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
    }
  }
  throw lastError;
}

async function getBestPrice(watchParams = {}) {
  const { from, to, date_from, date_to } = watchParams;
  if (!from || !to || !date_from) {
    throw new Error('Parámetros insuficientes para consultar precios');
  }

  const range = buildDateRange({ date_from, date_to });
  const tripType = date_to ? 'RT' : 'OW';
  const departureRangeStart = range.from;
  const departureRangeEnd = range.to;
  const months = enumerateMonths(departureRangeStart, departureRangeEnd);
  const allPrices = [];
  const outboundCompact = toCompactDate(departureRangeStart);
  const returnCompact = date_to ? toCompactDate(parseDate(date_to)) : undefined;

  for (const { month, year } of months) {
    const monthPrices = await fetchMonthPrices({
      triptype: tripType,
      origin: from,
      destination: to,
      outboundDate: outboundCompact,
      returnDate: tripType === 'RT' && returnCompact ? returnCompact : undefined,
      month,
      year,
      version: 1,
      currencyCode: 'USD'
    });
    allPrices.push(
      ...monthPrices.map((entry) => ({
        ...entry,
        date: entry.date
      }))
    );
  }

  if (allPrices.length === 0) {
    return null;
  }

  const best = allPrices
    .map((entry) => {
      const date = new Date(entry.date);
      return {
        price: Number(entry.price),
        date,
        isoDate: entry.date
      };
    })
    .filter((entry) => Number.isFinite(entry.price))
    .filter((entry) => entry.date >= departureRangeStart && entry.date <= departureRangeEnd)
    .sort((a, b) => a.price - b.price)[0];

  if (!best) {
    return null;
  }

  const deepLink = buildDeepLink({
    origin: from,
    destination: to,
    tripType,
    departureDate: best.isoDate,
    returnDate: date_to ? toIsoDate(parseDate(date_to)) : undefined
  });

  return {
    priceUsd: best.price,
    provider: 'Level',
    deepLink,
    foundAt: new Date().toISOString(),
    travelDate: toDdMmYyyy(best.date)
  };
}

module.exports = {
  getBestPrice
};
