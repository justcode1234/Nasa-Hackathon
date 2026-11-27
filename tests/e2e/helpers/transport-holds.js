export async function installTransportHolds(page, holds) {
  await page.addInitScript(config => {
    window.__transportHolds = {};
    window.__transportReleases = {};
    window.__transportReleased = {};
    for (const hold of config) {
      window.__transportHolds[hold.name] = null;
      window.__transportReleases[hold.name] = null;
      window.__transportReleased[hold.name] = false;
    }
    const match = path => config.find(hold => !window.__transportHolds[hold.name] &&
      path.includes(hold.pathIncludes) && (!hold.queryIncludes || path.includes(hold.queryIncludes)));
    const hold = (name, release) => {
      window.__transportHolds[name] = true;
      window.__transportReleases[name] = () => {
        window.__transportReleased[name] = true;
        release();
        window.__transportReleases[name] = null;
      };
    };
    window.__releaseTransportHold = name => window.__transportReleases[name]?.();
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(message) {
        const found = message?.path ? match(message.path) : null;
        if (found) {
          hold(found.name, () => this.onmessage({ data: { id: message.id, data: found.response } }));
          return;
        }
        return super.postMessage(message);
      }
    };
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(input?.url ?? input, location.href);
      const found = match(`${url.pathname}${url.search}`);
      if (found) {
        hold(found.name, () => {});
        return new Promise(resolve => {
          window.__transportReleases[found.name] = () => {
            window.__transportReleased[found.name] = true;
            resolve(new Response(JSON.stringify(found.response), { status: 200, headers: { 'content-type': 'application/json' } }));
            window.__transportReleases[found.name] = null;
          };
        });
      }
      return originalFetch(input, init);
    };
  }, holds);
}

export const waitForHold = (page, name) => page.waitForFunction(key => window.__transportHolds[key] === true, name);
export const releaseHold = async (page, name) => {
  await page.evaluate(key => window.__releaseTransportHold(key), name);
  await page.waitForFunction(key => window.__transportReleased[key] === true, name);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
