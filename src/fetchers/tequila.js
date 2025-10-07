const axios = require('axios');
const {
  TEQUILA_API_KEY,
  HTTP_TIMEOUT_MS,
  FLEX_DAYS
} = require('../config');

const BASE_URL = 'https://tequila-api.kiwi.com';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [500, 1500, 3500];

const client = axios.create({
  baseURL: BASE_URL,
  timeout: HTTP_TIMEOUT_MS
});

function parseDate(input) {
  const [day, month, year] = input.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function shiftDate(date, days) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function buildDateRange(dateFrom, dateTo) {
  if (dateTo) {
    return { from: dateFrom, to: dateTo };
  }
  const base = parseDate(dateFrom);
  if (Number.isNaN(base.getTime())) {
    return { from: dateFrom, to: dateFrom };
  }
  if (FLEX_DAYS > 0) {
    const start = shiftDate(base, -FLEX_DAYS);
    const end = shiftDate(base, FLEX_DAYS);
    return { from: formatDate(start), to: formatDate(end) };
  }
  return { from: dateFrom, to: dateFrom };
}

function shouldRetry(error) {
  if (error.response) {
    const { status } = error.response;
    return status === 429 || (status >= 500 && status < 600);
  }
  return Boolean(error.code === 'ECONNABORTED');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBestPrice(watchParams = {}) {
  const { from, to, date_from, date_to } = watchParams;
  const dateRange = buildDateRange(date_from, date_to);

  const params = {
    fly_from: from,
    fly_to: to,
    date_from: dateRange.from,
    date_to: dateRange.to,
    curr: 'USD',
    one_for_city: 1,
    limit: 5,
    sort: 'price'
  };

  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.get('/v2/search', {
        headers: {
          apikey: TEQUILA_API_KEY
        },
        params
      });
      const data = response.data?.data;
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }
      const best = data[0];
      const price = Number(best.price);
      if (Number.isNaN(price)) {
        return null;
      }
      return {
        priceUsd: price,
        provider: 'Kiwi',
        deepLink: best.deep_link || best.booking_link || '',
        foundAt: new Date().toISOString()
      };
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

module.exports = {
  getBestPrice
};
