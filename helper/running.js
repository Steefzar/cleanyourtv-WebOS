// The launcher's Running apps menu (Back on Home): the apps that are open now, to close them. Only the apps the launcher knows are listed
// (the visible apps of listApps, hidden ones too), never Home or CleanYourTV's own apps (the manager, and the picker and notify apps that
// are meant to stay up), and only listed apps can be closed. Closing also drops the app from LG's recents, as LG's own Recents panel does.
const HOME = 'com.webos.app.home', OWN = /^com\.cleanyourtv\./, AM = 'luna://com.webos.applicationManager/';

// running: the list of applicationManager/running; apps: the launcher's apps ({ id, title })
function pick(running, apps) {
  const title = {}, seen = {}, out = [];
  (apps || []).forEach(a => { title[a.id] = a.title || a.id; });
  (running || []).forEach(r => {
    const id = r && (r.id || r.appId);
    if (!id || seen[id] || id === HOME || OWN.test(id) || !Object.prototype.hasOwnProperty.call(title, id)) return;
    seen[id] = true; out.push({ id, title: title[id] });
  });
  return out;
}

function create(luna, apps) {
  async function list() {
    const r = await luna(AM + 'running', {});
    if (!Array.isArray(r.running)) return { apps: [], error: r.errorText || 'the app manager did not answer' };
    return { apps: pick(r.running, await apps()) };
  }
  // closeByAppId is the call that works on webOS 6, plain close the fallback (as for the picker in helper.js)
  async function close(id) {
    let r = await luna(AM + 'closeByAppId', { id });
    if (r.returnValue !== true) r = await luna(AM + 'close', { id });
    if (r.returnValue !== true) return false;
    await luna('luna://com.webos.service.recent/removeRecent', { appId: id });   // not on every webOS; the app is closed either way
    return true;
  }
  async function handle(req, res, u, body) {
    const json = (o, c) => { res.writeHead(c || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u === '/api/running') return json(await list());
    if (u === '/api/running/close' && req.method === 'POST') {
      const b = await body(req), ids = (await list()).apps.map(a => a.id).filter(id => b.all || id === b.id);
      if (!ids.length) return json({ returnValue: false, errorText: b.all ? 'nothing is running' : 'not a running app' });
      const closed = [];
      for (const id of ids) if (await close(id)) closed.push(id);
      return json({ returnValue: closed.length === ids.length, closed });
    }
    return json({ error: 'not found' }, 404);
  }
  return { handle, list, close };
}
module.exports = { create, pick };
