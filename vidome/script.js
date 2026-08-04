const categoryNames = {
  music: 'موسیقی',
  tech: 'تکنولوژی',
  nature: 'طبیعت',
  sport: 'ورزش',
  other: 'سایر'
};

const EMAIL_DOMAIN = '@vidome.local'; // برای تبدیل نام کاربری به ایمیل جهت Supabase Auth
const MAX_FILE_SIZE = 80 * 1024 * 1024; // ۸۰ مگابایت
const BUCKET = 'videos';

let currentUser = null; // نام کاربری نمایشی
let currentUid = null;
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

function usernameToEmail(username) {
  return username.toLowerCase() + EMAIL_DOMAIN;
}

function friendlyAuthError(msg) {
  if (!msg) return 'خطایی رخ داد. دوباره تلاش کنید.';
  if (msg.includes('already registered')) return 'این نام کاربری قبلاً ثبت شده است.';
  if (msg.includes('Password should be at least')) return 'رمز عبور حداقل باید ۶ کاراکتر باشد.';
  if (msg.includes('Invalid login credentials')) return 'نام کاربری یا رمز عبور اشتباه است.';
  if (msg.includes('Email not confirmed')) return 'ثبت‌نام هنوز تأیید نشده. تنظیمات «Confirm email» را در Supabase خاموش کنید.';
  return msg;
}

async function register(username, password) {
  if (username.length < 3) return { ok: false, msg: 'نام کاربری حداقل ۳ کاراکتر باشد.' };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { ok: false, msg: 'نام کاربری فقط می‌تواند شامل حروف/اعداد انگلیسی و _ باشد.' };
  if (password.length < 6) return { ok: false, msg: 'رمز عبور حداقل ۶ کاراکتر باشد.' };

  const { data, error } = await supabaseClient.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username } }
  });

  if (error) return { ok: false, msg: friendlyAuthError(error.message) };
  if (!data.session) {
    return { ok: false, msg: 'ثبت‌نام انجام شد ولی ورود خودکار انجام نشد. لطفاً «Confirm email» را در تنظیمات Supabase Auth خاموش کنید (README.md را ببینید).' };
  }
  return { ok: true };
}

async function login(username, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });
  if (error) return { ok: false, msg: friendlyAuthError(error.message) };
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
    emptyText.textContent = 'روی دکمه «آپلود ویدیو» کلیک کنید و اولین ویدیوی این سایت را اضافه کنید.';
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
  supabaseClient.auth.signOut();
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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const result = await login(user, pass);
  submitBtn.disabled = false;
  const errEl = document.getElementById('loginError');
  if (!result.ok) {
    errEl.textContent = result.msg;
    errEl.hidden = false;
    return;
  }
  closeModal('auth');
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
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
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const result = await register(user, pass);
  submitBtn.disabled = false;
  if (!result.ok) {
    errEl.textContent = result.msg;
    errEl.hidden = false;
    return;
  }
  closeModal('auth');
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

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser || !selectedFile) {
    showUploadError('لطفاً یک فایل ویدیو انتخاب کنید.');
    return;
  }

  if (selectedFile.size > MAX_FILE_SIZE) {
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
  progressFill.style.width = '15%';
  progressText.textContent = 'در حال استخراج اطلاعات ویدیو...';

  try {
    const blob = selectedFile;
    const meta = await getVideoMeta(blob);

    progressFill.style.width = '35%';
    progressText.textContent = 'در حال آپلود فایل...';

    const storagePath = `${currentUid}/${Date.now()}_${sanitizeFileName(blob.name)}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET)
      .upload(storagePath, blob, { contentType: blob.type, upsert: false });

    if (uploadError) throw uploadError;

    progressFill.style.width = '75%';
    progressText.textContent = 'در حال ذخیره اطلاعات...';

    const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(storagePath);

    const { error: insertError } = await supabaseClient.from('videos').insert({
      title,
      category,
      description,
      owner: currentUser,
      owner_uid: currentUid,
      duration: meta.duration || 0,
      size: blob.size,
      mime: blob.type,
      storage_path: storagePath
    });

    if (insertError) throw insertError;

    progressFill.style.width = '100%';
    progressText.textContent = 'آپلود موفق!';

    await loadVideos();

    setTimeout(() => {
      closeModal('upload');
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
  const { data, error } = await supabaseClient
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('خطا در بارگذاری ویدیوها:', error);
    return;
  }

  allVideos = (data || []).map(r => {
    const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(r.storage_path);
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description || '',
      owner: r.owner,
      ownerUid: r.owner_uid,
      createdAt: new Date(r.created_at).getTime(),
      duration: r.duration || 0,
      objectURL: urlData.publicUrl,
      storagePath: r.storage_path,
      mime: r.mime
    };
  });

  filterAndRender();
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
  delBtn.hidden = !(currentUid && currentUid === video.ownerUid);

  videoModal.hidden = false;
  document.body.style.overflow = 'hidden';
  player.play().catch(() => {});
}

document.getElementById('deleteVideoBtn').addEventListener('click', async () => {
  if (!currentPlayingId || !currentUid) return;
  if (!confirm('آیا مطمئن هستید که می‌خواهید این ویدیو را حذف کنید؟')) return;

  const video = allVideos.find(v => v.id === currentPlayingId);
  if (!video) return;

  try {
    const { error: delRowError } = await supabaseClient.from('videos').delete().eq('id', currentPlayingId);
    if (delRowError) throw delRowError;

    if (video.storagePath) {
      await supabaseClient.storage.from(BUCKET).remove([video.storagePath]);
    }
    closeModal('video');
    await loadVideos();
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

supabaseClient.auth.onAuthStateChange((event, session) => {
  const user = session ? session.user : null;
  if (user) {
    currentUser = (user.user_metadata && user.user_metadata.username) || (user.email || '').split('@')[0];
    currentUid = user.id;
  } else {
    currentUser = null;
    currentUid = null;
  }
  updateAuthUI();
  filterAndRender();
});

// هر ۱۵ ثانیه لیست را تازه می‌کند تا ویدیوهای بازدیدکننده‌های دیگر هم دیده شود
setInterval(loadVideos, 15000);

async function init() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = (session.user.user_metadata && session.user.user_metadata.username) || (session.user.email || '').split('@')[0];
      currentUid = session.user.id;
    }
    updateAuthUI();
    await loadVideos();
  } catch (err) {
    console.error('Init error:', err);
    alert('خطا در اتصال به Supabase. لطفاً supabase-config.js را با اطلاعات پروژه خودتان پر کنید (README.md را ببینید).');
  }
}

init();
