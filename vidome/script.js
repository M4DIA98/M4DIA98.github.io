const DB_NAME = 'VidomeDB';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const USERS_KEY = 'vm_users';
const SESSION_KEY = 'vm_session';

const categoryNames = {
  music: 'موسیقی',
  tech: 'تکنولوژی',
  nature: 'طبیعت',
  sport: 'ورزش',
  other: 'سایر'
};

let db = null;
let currentUser = null;
let allVideos = [];
let currentCategory = 'all';
let currentSearch = '';
let selectedFile = null;
let currentPlayingId = null;

const videoGrid = document.getElementById('videoGrid');
const emptyState = document.getElementById('emptyState');
const noResults = document.getElementById('noResults');
const sectionTitle = document.getElementById('sectionTitle');
const videoCount = document.getElementById('videoCount');
const authArea = document.getElementById('authArea');
const uploadBtn = document.getElementById('uploadBtn');
const searchInput = document.getElementById('searchInput');
const heroText = document.getElementById('heroText');
const emptyText = document.getElementById('emptyText');

const authModal = document.getElementById('authModal');
const uploadModal = document.getElementById('uploadModal');
const videoModal = document.getElementById('videoModal');

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE)) {
        const store = database.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
        store.createIndex('owner', 'owner', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function saveVideoToDB(videoData) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    const store = tx.objectStore(VIDEO_STORE);
    const req = store.put(videoData);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAllVideosFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const store = tx.objectStore(VIDEO_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deleteVideoFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    const store = tx.objectStore(VIDEO_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(username) {
  if (username) localStorage.setItem(SESSION_KEY, username);
  else localStorage.removeItem(SESSION_KEY);
}

function register(username, password) {
  const users = getUsers();
  if (users[username]) return { ok: false, msg: 'این نام کاربری قبلاً ثبت شده است.' };
  if (username.length < 3) return { ok: false, msg: 'نام کاربری حداقل ۳ کاراکتر باشد.' };
  if (password.length < 4) return { ok: false, msg: 'رمز عبور حداقل ۴ کاراکتر باشد.' };
  users[username] = { password, createdAt: Date.now() };
  saveUsers(users);
  return { ok: true };
}

function login(username, password) {
  const users = getUsers();
  if (!users[username]) return { ok: false, msg: 'کاربری با این نام یافت نشد.' };
  if (users[username].password !== password) return { ok: false, msg: 'رمز عبور اشتباه است.' };
  return { ok: true };
}

function updateAuthUI() {
  if (currentUser) {
    authArea.innerHTML = `
      <div class="user-badge">
        <span>👤</span>
        <strong>${escapeHtml(currentUser)}</strong>
      </div>
      <button class="btn btn-outline btn-sm" id="logoutBtn">خروج</button>
    `;
    uploadBtn.hidden = false;
    heroText.textContent = `سلام ${currentUser}! ویدیوهای خود را آپلود کنید`;
    emptyText.textContent = 'روی دکمه «آپلود ویدیو» کلیک کنید و اولین ویدیوی خود را اضافه کنید.';
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  } else {
    authArea.innerHTML = `
      <button class="btn btn-outline btn-sm" id="loginBtn">ورود</button>
      <button class="btn btn-primary btn-sm" id="registerBtn">ثبت‌نام</button>
    `;
    uploadBtn.hidden = true;
    heroText.textContent = 'ویدیوهای خود را آپلود کنید و تماشا کنید';
    emptyText.textContent = 'برای شروع، وارد حساب کاربری شوید و ویدیو آپلود کنید.';
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal('register'));
  }
}

function handleLogout() {
  currentUser = null;
  setSession(null);
  updateAuthUI();
  filterAndRender();
}

function openAuthModal(tab = 'login') {
  authModal.hidden = false;
  document.body.style.overflow = 'hidden';
  switchAuthTab(tab);
  document.getElementById('loginError').hidden = true;
  document.getElementById('regError').hidden = true;
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('loginForm').hidden = tab !== 'login';
  document.getElementById('registerForm').hidden = tab !== 'register';
}

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const result = login(user, pass);
  const errEl = document.getElementById('loginError');
  if (!result.ok) {
    errEl.textContent = result.msg;
    errEl.hidden = false;
    return;
  }
  currentUser = user;
  setSession(user);
  closeModal('auth');
  updateAuthUI();
  filterAndRender();
});

document.getElementById('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('regUser').value.trim();
  const pass = document.getElementById('regPass').value;
  const pass2 = document.getElementById('regPass2').value;
  const errEl = document.getElementById('regError');

  if (pass !== pass2) {
    errEl.textContent = 'رمز عبور و تکرار آن یکسان نیست.';
    errEl.hidden = false;
    return;
  }
  const result = register(user, pass);
  if (!result.ok) {
    errEl.textContent = result.msg;
    errEl.hidden = false;
    return;
  }
  currentUser = user;
  setSession(user);
  closeModal('auth');
  updateAuthUI();
  filterAndRender();
});

uploadBtn.addEventListener('click', () => {
  if (!currentUser) return;
  uploadModal.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('uploadForm').reset();
  selectedFile = null;
  document.getElementById('fileSelected').hidden = true;
  document.getElementById('fileDropText').hidden = false;
  document.getElementById('uploadError').hidden = true;
  document.getElementById('uploadProgress').hidden = true;
  document.getElementById('submitUpload').disabled = false;
});

const fileInput = document.getElementById('videoFile');
const fileDrop = document.getElementById('fileDrop');

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    selectedFile = fileInput.files[0];
    showSelectedFile(selectedFile.name);
  }
});

fileDrop.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDrop.classList.add('dragover');
});
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDrop.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith('video/')) {
      showUploadError('فقط فایل ویدیویی مجاز است.');
      return;
    }
    selectedFile = file;
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    showSelectedFile(file.name);
  }
});

document.getElementById('clearFile').addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('fileSelected').hidden = true;
  document.getElementById('fileDropText').hidden = false;
});

function showSelectedFile(name) {
  document.getElementById('fileName').textContent = name;
  document.getElementById('fileSelected').hidden = false;
  document.getElementById('fileDropText').hidden = true;
  document.getElementById('uploadError').hidden = true;
}

function showUploadError(msg) {
  const el = document.getElementById('uploadError');
  el.textContent = msg;
  el.hidden = false;
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser || !selectedFile) {
    showUploadError('لطفاً یک فایل ویدیو انتخاب کنید.');
    return;
  }

  if (selectedFile.size > 80 * 1024 * 1024) {
    showUploadError('حجم فایل خیلی بزرگ است (حداکثر حدود ۸۰ مگابایت).');
    return;
  }

  const title = document.getElementById('videoTitle').value.trim();
  const category = document.getElementById('videoCategory').value;
  const description = document.getElementById('videoDesc').value.trim();

  const progressEl = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const submitBtn = document.getElementById('submitUpload');

  progressEl.hidden = false;
  submitBtn.disabled = true;
  progressFill.style.width = '20%';
  progressText.textContent = 'در حال آماده‌سازی...';

  try {
    const id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const blob = selectedFile;
    const objectURL = URL.createObjectURL(blob);

    progressFill.style.width = '50%';
    progressText.textContent = 'در حال استخراج اطلاعات ویدیو...';

    const meta = await getVideoMeta(blob);

    progressFill.style.width = '80%';
    progressText.textContent = 'در حال ذخیره...';

    const videoRecord = {
      id,
      title,
      category,
      description,
      owner: currentUser,
      createdAt: Date.now(),
      duration: meta.duration || 0,
      size: blob.size,
      mime: blob.type,
      blob
    };

    await saveVideoToDB(videoRecord);

    allVideos.unshift({
      id,
      title,
      category,
      description,
      owner: currentUser,
      createdAt: videoRecord.createdAt,
      duration: videoRecord.duration,
      objectURL,
      mime: blob.type
    });

    progressFill.style.width = '100%';
    progressText.textContent = 'آپلود موفق!';

    setTimeout(() => {
      closeModal('upload');
      filterAndRender();
    }, 400);
  } catch (err) {
    console.error(err);
    showUploadError('خطا در آپلود: ' + (err.message || 'مشکل ناشناخته'));
    progressEl.hidden = true;
    submitBtn.disabled = false;
  }
});

function getVideoMeta(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0 });
    }, 8000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve({ duration: isFinite(duration) ? duration : 0 });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ duration: 0 });
    };
    video.src = url;
  });
}

function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('fa-IR');
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadVideos() {
  const records = await getAllVideosFromDB();
  allVideos.forEach(v => {
    if (v.objectURL) URL.revokeObjectURL(v.objectURL);
  });

  allVideos = records.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description || '',
    owner: r.owner,
    createdAt: r.createdAt,
    duration: r.duration || 0,
    objectURL: URL.createObjectURL(r.blob),
    mime: r.mime
  })).sort((a, b) => b.createdAt - a.createdAt);
}

function filterAndRender() {
  let list = [...allVideos];

  if (currentCategory !== 'all') {
    list = list.filter(v => v.category === currentCategory);
  }
  if (currentSearch.trim()) {
    const q = currentSearch.trim().toLowerCase();
    list = list.filter(v =>
      v.title.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      v.owner.toLowerCase().includes(q) ||
      (categoryNames[v.category] || '').includes(q)
    );
  }

  if (currentSearch.trim()) {
    sectionTitle.textContent = `نتایج جستجو برای «${currentSearch}»`;
  } else if (currentCategory === 'all') {
    sectionTitle.textContent = 'همه ویدیوها';
  } else {
    sectionTitle.textContent = `دسته ${categoryNames[currentCategory] || currentCategory}`;
  }

  renderVideos(list);
}

function renderVideos(list) {
  videoGrid.innerHTML = '';
  noResults.hidden = true;
  emptyState.hidden = true;

  if (allVideos.length === 0) {
    emptyState.hidden = false;
    videoCount.textContent = '';
    return;
  }

  if (list.length === 0) {
    noResults.hidden = false;
    videoCount.textContent = '۰ ویدیو';
    return;
  }

  videoCount.textContent = `${list.length} ویدیو`;

  list.forEach(video => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.dataset.id = video.id;

    card.innerHTML = `
      <div class="video-thumb">
        <div class="placeholder-thumb">▶</div>
        <span class="video-duration">${formatDuration(video.duration)}</span>
        <div class="video-play-icon"><span>▶</span></div>
      </div>
      <div class="video-info">
        <h3 class="video-title">${escapeHtml(video.title)}</h3>
        <div class="video-meta">
          <span>${escapeHtml(video.owner)}</span>
          <span class="video-category">${categoryNames[video.category] || video.category}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openPlayer(video));
    videoGrid.appendChild(card);
  });
}

function openPlayer(video) {
  currentPlayingId = video.id;
  const player = document.getElementById('modalVideo');
  player.src = video.objectURL;
  document.getElementById('modalTitle').textContent = video.title;
  document.getElementById('modalOwner').textContent = '👤 ' + video.owner;
  document.getElementById('modalCategory').textContent = categoryNames[video.category] || video.category;
  document.getElementById('modalDate').textContent = formatDate(video.createdAt);
  document.getElementById('modalDesc').textContent = video.description || 'بدون توضیحات';

  const delBtn = document.getElementById('deleteVideoBtn');
  delBtn.hidden = !(currentUser && currentUser === video.owner);

  videoModal.hidden = false;
  document.body.style.overflow = 'hidden';
  player.play().catch(() => {});
}

document.getElementById('deleteVideoBtn').addEventListener('click', async () => {
  if (!currentPlayingId || !currentUser) return;
  if (!confirm('آیا مطمئن هستید که می‌خواهید این ویدیو را حذف کنید؟')) return;

  try {
    await deleteVideoFromDB(currentPlayingId);
    const idx = allVideos.findIndex(v => v.id === currentPlayingId);
    if (idx !== -1) {
      if (allVideos[idx].objectURL) URL.revokeObjectURL(allVideos[idx].objectURL);
      allVideos.splice(idx, 1);
    }
    closeModal('video');
    filterAndRender();
  } catch (err) {
    alert('خطا در حذف ویدیو');
    console.error(err);
  }
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    currentCategory = link.dataset.category;
    currentSearch = '';
    searchInput.value = '';
    filterAndRender();
  });
});

function doSearch() {
  currentSearch = searchInput.value;
  if (currentSearch.trim()) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
    currentCategory = 'all';
  }
  filterAndRender();
}

document.getElementById('searchBtn').addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(doSearch, 280);
});

function closeModal(name) {
  if (name === 'auth') authModal.hidden = true;
  if (name === 'upload') uploadModal.hidden = true;
  if (name === 'video') {
    videoModal.hidden = true;
    const player = document.getElementById('modalVideo');
    player.pause();
    player.removeAttribute('src');
    player.load();
    currentPlayingId = null;
  }
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => closeModal(el.dataset.close));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!authModal.hidden) closeModal('auth');
    else if (!uploadModal.hidden) closeModal('upload');
    else if (!videoModal.hidden) closeModal('video');
  }
});

async function init() {
  try {
    await openDB();
    const session = getSession();
    if (session && getUsers()[session]) {
      currentUser = session;
    }
    updateAuthUI();
    await loadVideos();
    filterAndRender();
  } catch (err) {
    console.error('Init error:', err);
    alert('خطا در راه‌اندازی پایگاه داده مرورگر. لطفاً مرورگر را به‌روز کنید یا حالت خصوصی را خاموش کنید.');
  }
}

init();
