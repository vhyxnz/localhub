const cats = ['All', 'Games', 'Tools', 'Lifestyle', 'Finance', 'Developer', 'Education'];
const DB = 'LocalHubStoreDB', STORE = 'apps';
let active = 'All', apps = [], installed = new Map(), pending = new Map();

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allApps() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.reverse());
    request.onerror = () => reject(request.error);
  });
}

async function addApp(app) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).add(app);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeApp(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

const esc = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const size = bytes => bytes > 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round((bytes || 0) / 1000)) + ' KB';
const key = id => encodeURIComponent(String(id));
const getApp = id => apps.find(app => String(app.id) === decodeURIComponent(id));

function icon(app, big = '') {
  return `<div class="icon ${big}" ${app.icon ? `style="background-image:url(&quot;${esc(app.icon)}&quot;)"` : ''}><b>${app.icon ? '' : esc(app.name[0])}</b></div>`;
}

function isInstallable(app) {
  return Boolean(app.packageUrl) || Boolean(app.file && app.file.name.toLowerCase().endsWith('.localhub-app'));
}

function compareVersions(left = '0.0.0', right = '0.0.0') {
  const a = String(left).split('.').map(part => parseInt(part, 10) || 0);
  const b = String(right).split('.').map(part => parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

function normaliseAppName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function installedVersion(app) {
  return installed.get(String(app.id)) || installed.get('name:' + normaliseAppName(app.name));
}

function hasUpdate(app) {
  const version = installedVersion(app);
  return version !== undefined && compareVersions(app.version, version) > 0;
}

function actionLabel(app) {
  if (hasUpdate(app)) return `↻ Update to ${esc(app.version)}`;
  if (installedVersion(app) !== undefined) return '✓ Installed';
  return isInstallable(app) ? '＋ Install in Local Hub' : `↓ Download ${esc(app.fileType || 'file')}`;
}

function render() {
  const query = document.querySelector('#search').value.toLowerCase();
  document.querySelector('#chips').innerHTML = cats.map(category => `<button class="${category === active ? 'active' : ''}" onclick="active='${category}';render()">${category}</button>`).join('');
  const list = apps.filter(app => (active === 'All' || app.category === active) && `${app.name} ${app.developer} ${app.description}`.toLowerCase().includes(query));
  document.querySelector('#grid').innerHTML = list.length ? list.map(app => `<article class="card" onclick="details('${key(app.id)}')">${icon(app)}<div class="info"><h3>${esc(app.name)}</h3><p>${esc(app.category)} · ${esc(app.developer)}</p><div class="meta"><span>${app.builtIn ? 'LOCAL HUB APP' : 'COMMUNITY'}</span><span>${size(app.size || app.file?.size)}</span><span class="tag">${hasUpdate(app) ? 'UPDATE' : installedVersion(app) !== undefined ? 'INSTALLED' : 'APP'}</span></div></div><div class="arrow">›</div></article>`).join('') : '<div class="empty"><h3>No apps found</h3><p>Try another search or category.</p></div>';
}

function openUpload() { document.querySelector('#uploadModal').classList.add('open'); }
function closeModal(id) { document.querySelector('#' + id).classList.remove('open'); }
function backdrop(event, id) { if (event.target.id === id) closeModal(id); }
function goBrowse() { document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' }); }
function notify(text) { const toast = document.querySelector('#toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }

document.querySelector('#form').onsubmit = async event => {
  event.preventDefault();
  const form = new FormData(event.target), file = form.get('file'), iconFile = form.get('icon');
  if (file.size > 100 * 1024 * 1024) return notify('File is larger than 100 MB');
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['html', 'htm', 'zip', 'apk', 'localhub-app'].includes(extension)) return notify('Unsupported file type');
  let image = '';
  if (iconFile?.size) image = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(iconFile); });
  const app = { id: 'user-' + Date.now(), name: form.get('name'), developer: form.get('developer'), version: form.get('version'), category: form.get('category'), description: form.get('description'), file, icon: image, fileType: extension === 'apk' ? 'APK' : extension === 'localhub-app' ? 'LOCALHUB-APP' : 'HTML', size: file.size, date: Date.now() };
  await addApp(app); apps.unshift(app); event.target.reset(); event.target.developer.value = 'Local Hub Studio'; event.target.version.value = '1.0'; closeModal('uploadModal'); render(); notify(app.name + ' was published');
};

function details(id) {
  const app = getApp(id); if (!app) return;
  const removable = app.builtIn ? '' : `<button class="danger" onclick="deleteApp('${key(app.id)}')">Remove from store</button>`;
  document.querySelector('#detail').innerHTML = `<button class="close" onclick="closeModal('detailModal')">✕</button><div class="detail-head">${icon(app, 'big')}<div><span class="tag">${app.builtIn ? 'LOCALHUB-APP' : esc(app.fileType || 'APP')}</span><h2>${esc(app.name)}</h2><p class="sub">${esc(app.developer)}</p></div></div><p class="desc">${esc(app.description)}</p><div class="stats"><div><b>${esc(app.version)}</b><span>version</span></div><div><b>${size(app.size || app.file?.size)}</b><span>package size</span></div><div><b>Offline</b><span>after install</span></div></div><button class="primary download" ${installedVersion(app) !== undefined && !hasUpdate(app) ? 'disabled' : ''} onclick="installOrDownload('${key(app.id)}')">${actionLabel(app)}</button>${removable}`;
  document.querySelector('#detailModal').classList.add('open');
}

async function installOrDownload(id) {
  const app = getApp(id); if (!app) return;
  if (isInstallable(app)) {
    try {
      notify('Installing ' + app.name + '…');
      const response = app.packageUrl ? await fetch(app.packageUrl) : null;
      if (response && !response.ok) throw new Error('Package unavailable');
      const payload = JSON.parse(response ? await response.text() : await app.file.text());
      const requestId = Date.now() + '-' + Math.random().toString(36).slice(2);
      pending.set(requestId, app);
      parent.postMessage({ type: 'localhub:install-package', requestId, payload }, '*');
    } catch { notify('Could not install ' + app.name); }
  } else {
    const url = URL.createObjectURL(app.file), link = document.createElement('a'); link.href = url; link.download = app.file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function deleteApp(id) {
  const app = getApp(id); if (!app || app.builtIn || !confirm('Remove this app and its saved file?')) return;
  await removeApp(app.id); apps = apps.filter(item => item !== app); closeModal('detailModal'); render(); notify('App removed');
}

window.addEventListener('message', event => {
  if (event.data?.type === 'localhub:installed-apps') {
    installed = new Map();
    for (const app of event.data.apps || event.data.packageIds.map(packageId => ({ packageId, version: '0.0.0' }))) {
      if (app.packageId) installed.set(String(app.packageId), app.version || '0.0.0');
      if (app.name) installed.set('name:' + normaliseAppName(app.name), app.version || '0.0.0');
    }
    render(); return;
  }
  if (event.data?.type !== 'localhub:install-result') return;
  const app = pending.get(event.data.requestId); pending.delete(event.data.requestId);
  if (event.data.ok && app) { installed.set(String(app.id), app.version || '0.0.0'); installed.set('name:' + normaliseAppName(app.name), app.version || '0.0.0'); details(key(app.id)); render(); notify(app.name + (event.data.updated ? ' was updated' : ' is installed')); }
  else notify(event.data.error || 'Install failed');
});

(async () => {
  try {
    const [catalog, userApps] = await Promise.all([fetch('Local Hub Store/catalog.json').then(response => { if (!response.ok) throw new Error(); return response.json(); }), allApps()]);
    apps = [...catalog.map(app => ({ ...app, builtIn: true })), ...userApps];
    parent.postMessage({ type: 'localhub:list-installed', requestId: 'startup' }, '*');
    render();
  } catch {
    notify('The app catalog is unavailable'); apps = await allApps().catch(() => []); render();
  }
})();
