const axios = require('axios');
const {
  HTTP_TIMEOUT_MS,
  FLEX_DAYS
} = require('../config');

const BASE_URL = 'https://www.flylevel.com';
const CALENDAR_ENDPOINT = '/nwe/flights/api/calendar/';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [300, 900, 1800];

const client = axios.create({
  baseURL: BASE_URL,
  timeout: HTTP_TIMEOUT_MS,
  headers: {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Referer: 'https://www.flylevel.com/',
    Origin: 'https://www.flylevel.com'
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
  const normalizedParams = { ...params };
  if (normalizedParams.month !== undefined && normalizedParams.month !== null) {
    const monthNumber = Number.parseInt(normalizedParams.month, 10);
    if (!Number.isNaN(monthNumber)) {
      normalizedParams.month = `${monthNumber}`.padStart(2, '0');
    } else if (typeof normalizedParams.month === 'string') {
      normalizedParams.month = normalizedParams.month.padStart(2, '0');
    }
  }
  if (normalizedParams.year !== undefined && normalizedParams.year !== null) {
    normalizedParams.year = `${normalizedParams.year}`;
  }

  const sanitizedParams = Object.fromEntries(
    Object.entries(normalizedParams).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.get(CALENDAR_ENDPOINT, { params: sanitizedParams });
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

async function getBestPriceForRange(watchParams = {}) {
  const { from, to, date_from: dateFrom, date_to: dateTo } = watchParams;
  if (!from || !to || !dateFrom) {
    throw new Error('Parámetros insuficientes para consultar precios');
  }

  const range = buildDateRange({ date_from: dateFrom, date_to: dateTo });
  const tripType = watchParams.trip_type || (dateTo ? 'RT' : 'OW');
  const departureRangeStart = range.from;
  const departureRangeEnd = range.to;
  const months = enumerateMonths(departureRangeStart, departureRangeEnd);
  const allPrices = [];
  const outboundCompact = toCompactDate(departureRangeStart);
  const returnCompact = dateTo ? toCompactDate(parseDate(dateTo)) : undefined;

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
    returnDate: tripType === 'RT' && dateTo ? toIsoDate(parseDate(dateTo)) : undefined
  });

  return {
    priceUsd: best.price,
    provider: 'Level',
    deepLink,
    foundAt: new Date().toISOString(),
    travelDate: toDdMmYyyy(best.date)
  };
}

async function getBestPriceForMonth(watchParams = {}) {
  const { from, to, month, year } = watchParams;
  if (!from || !to || !month || !year) {
    throw new Error('Parámetros insuficientes para consultar el mes completo');
  }

  const tripType = watchParams.trip_type || 'RT';

  const monthPrices = await fetchMonthPrices({
    triptype: tripType,
    origin: from,
    destination: to,
    month,
    year,
    version: 1,
    currencyCode: 'USD'
  });

  if (!Array.isArray(monthPrices) || monthPrices.length === 0) {
    return null;
  }

  const best = monthPrices
    .map((entry) => ({
      price: Number(entry.price),
      isoDate: entry.date,
      date: new Date(entry.date)
    }))
    .filter((entry) => Number.isFinite(entry.price))
    .sort((a, b) => a.price - b.price)[0];

  if (!best) {
    return null;
  }

  const deepLink = buildDeepLink({
    origin: from,
    destination: to,
    tripType,
    departureDate: best.isoDate
  });

  return {
    priceUsd: best.price,
    provider: 'Level',
    deepLink,
    foundAt: new Date().toISOString(),
    travelDate: toDdMmYyyy(best.date)
  };
}

async function getBestPrice(watchParams = {}) {
  const mode = watchParams.mode || 'range';
  if (mode === 'month') {
    return getBestPriceForMonth(watchParams);
  }
  return getBestPriceForRange(watchParams);
}

module.exports = {
  getBestPrice
};
