const fs = require('fs/promises');
const path = require('path');
const { DATA_FILE } = require('./config');

class WatchStore {
  constructor(filePath = DATA_FILE) {
    this.filePath = filePath;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.#writeAll([]);
    }
    this.initialized = true;
  }

  async getAll() {
    await this.init();
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      if (!raw.trim()) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid watches data format');
      }
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getById(id) {
    const watches = await this.getAll();
    return watches.find((watch) => watch.id === id) || null;
  }

  async add(watchData) {
    const watches = await this.getAll();
    const nextId = watches.reduce((maxId, watch) => Math.max(maxId, watch.id || 0), 0) + 1;
    const mode = watchData.mode || 'range';
    const tripType = watchData.trip_type
      || (mode === 'range' ? (watchData.date_to ? 'RT' : 'OW') : 'RT');
    const newWatch = {
      id: nextId,
      from: watchData.from,
      to: watchData.to,
      mode,
      date_from: mode === 'range' ? watchData.date_from : null,
      date_to: mode === 'range' ? watchData.date_to || null : null,
      month: mode === 'month' ? watchData.month : null,
      year: mode === 'month' ? watchData.year : null,
      trip_type: tripType,
      threshold_usd: watchData.threshold_usd,
      lastSeenPrice: null,
      lastSeenAt: null,
      lastAlertAt: null,
      lastAlertPrice: null,
      lastSeenTravelDate: null
    };
    await this.#writeAll([...watches, newWatch]);
    return newWatch;
  }

  async update(id, patch) {
    const watches = await this.getAll();
    const index = watches.findIndex((watch) => watch.id === id);
    if (index === -1) {
      return null;
    }
    const updated = { ...watches[index], ...patch, id };
    watches[index] = updated;
    await this.#writeAll(watches);
    return updated;
  }

  async remove(id) {
    const watches = await this.getAll();
    const filtered = watches.filter((watch) => watch.id !== id);
    if (filtered.length === watches.length) {
      return false;
    }
    await this.#writeAll(filtered);
    return true;
  }

  async #writeAll(watches) {
    const payload = `${JSON.stringify(watches, null, 2)}\n`;
    const tempPath = `${this.filePath}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, payload, 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }
}

module.exports = WatchStore;
