const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getIntEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

const TELEGRAM_TOKEN = getRequiredEnv('TELEGRAM_TOKEN');
const OWNER_CHAT_ID = getRequiredEnv('OWNER_CHAT_ID');
const TEQUILA_API_KEY = getRequiredEnv('TEQUILA_API_KEY');

const CHECK_INTERVAL_MIN = Math.max(1, getIntEnv('CHECK_INTERVAL_MIN', 10));
const QUIET_MIN = Math.max(1, getIntEnv('QUIET_MIN', 60));
const FLEX_DAYS = Math.max(0, getIntEnv('FLEX_DAYS', 0));
const HTTP_TIMEOUT_MS = Math.max(1000, getIntEnv('HTTP_TIMEOUT_MS', 8000));

const TZ = process.env.TZ || 'America/Argentina/Buenos_Aires';

module.exports = {
  TELEGRAM_TOKEN,
  OWNER_CHAT_ID,
  TEQUILA_API_KEY,
  CHECK_INTERVAL_MIN,
  QUIET_MIN,
  FLEX_DAYS,
  HTTP_TIMEOUT_MS,
  TZ,
  DATA_FILE: path.join(__dirname, '..', 'data', 'watches.json')
};
