const cron = require('node-cron');
const config = require('./config');
const levelFetcher = require('./fetchers/level');

function createScheduler({ store, notifier, fetcher = levelFetcher, appConfig = config }) {
  if (!store || !notifier) {
    throw new Error('Scheduler requires store and notifier');
  }

  let job = null;

  const expression = `*/${appConfig.CHECK_INTERVAL_MIN} * * * *`;

  async function runOnce() {
    const watches = await store.getAll();
    if (watches.length === 0) {
      return { processed: 0, alerts: 0, errors: [] };
    }

    const summary = { processed: 0, alerts: 0, errors: [] };

    for (const watch of watches) {
      summary.processed += 1;

      try {
        const previousPrice = typeof watch.lastSeenPrice === 'number' ? watch.lastSeenPrice : null;

        const result = await fetcher.getBestPrice(watch);

        const now = new Date();
        const updatePayload = {
          lastSeenAt: now.toISOString(),
          lastSeenPrice: result && typeof result.priceUsd === 'number' ? result.priceUsd : null,
          lastSeenTravelDate: result && result.travelDate ? result.travelDate : null
        };

        if (result) {
          const notification = await notifier.maybeNotify(
            watch,
            result,
            now,
            { previousPrice }
          );
          if (notification.notified) {
            updatePayload.lastAlertAt = now.toISOString();
            summary.alerts += 1;
          }
        }

        const updated = await store.update(watch.id, updatePayload);
        if (!updated) {
          summary.errors.push({ watchId: watch.id, message: 'Watch eliminado antes de guardar cambios' });
        }
      } catch (error) {
        summary.errors.push({ watchId: watch.id, message: error.message });
        // eslint-disable-next-line no-console
        console.error(`[scheduler] Error processing watch ${watch.id}:`, error.message);
      }
    }

    return summary;
  }

  function start() {
    if (job) {
      return job;
    }
    job = cron.schedule(
      expression,
      () => {
        runOnce().catch((error) => {
          // eslint-disable-next-line no-console
          console.error('[scheduler] Unexpected error in scheduled run:', error);
        });
      },
      {
        scheduled: true,
        timezone: appConfig.TZ
      }
    );
    job.start();
    return job;
  }

  function stop() {
    if (job) {
      job.stop();
      job = null;
    }
  }

  return {
    start,
    stop,
    runOnce
  };
}

module.exports = {
  createScheduler
};
