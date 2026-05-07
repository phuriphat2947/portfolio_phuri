const App = (() => {
  const STORAGE_KEY = 'portfolio_data';
  const PIN_KEY = 'portfolio_pin';
  const DEFAULT_PIN = '2547';
  let state = { editingId: null, editingType: null, adminMode: false, tempImage: null };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // ===== DATA MANAGEMENT =====
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  }
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Auto-sync: update the JSON preview indicator
    const indicator = $('#syncIndicator');
    if (indicator) indicator.textContent = '● มีการเปลี่ยนแปลง';
  }

  async function loadFromJSON() {
    try {
      const res = await fetch('data/portfolio.json');
      if (!res.ok) throw new Error('Failed');
      return await res.json();
    } catch {
      return {
        profile: {
          name: 'Your Name', title: 'Creative Designer & Video Editor',
          tagline: 'สร้างสรรค์ผลงานออกแบบและวิดีโอที่โดดเด่น', about: '',
          avatar: '', projects: 0, exp: 0, clients: 0,
          email: '', phone: '', facebook: '', instagram: '', youtube: ''
        },
        skills: [], works: [], videos: []
      };
    }
  }

  async function initData() {
    let data = load();
    if (!data) {
      data = await loadFromJSON();
      save(data);
    }
    return data;
  }

  function exportData() {
    const data = load();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'portfolio.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('ดาวน์โหลด portfolio.json สำเร็จ — นำไปแทนที่ไฟล์ใน data/ ได้เลย');
    const indicator = $('#syncIndicator');
    if (indicator) indicator.textContent = '✓ ซิงค์แล้ว';
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.profile || !data.skills) throw new Error('Invalid');
          save(data); renderAll();
          toast('นำเข้าข้อมูลสำเร็จ');
        } catch { toast('ไฟล์ JSON ไม่ถูกต้อง', 'error'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ===== PIN / AUTH =====
  function getPin() { return localStorage.getItem(PIN_KEY) || DEFAULT_PIN; }
  function setPin(pin) { localStorage.setItem(PIN_KEY, pin); }

  function showPinModal() {
    $('#pinInput').value = '';
    $('#pinError').textContent = '';
    showOverlay('pinModal');
    setTimeout(() => $('#pinInput').focus(), 100);
  }

  function verifyPin() {
    const input = $('#pinInput').value;
    if (input === getPin()) {
      hideOverlay('pinModal');
      activateAdmin();
    } else {
      $('#pinError').textContent = 'รหัสไม่ถูกต้อง!';
      $('#pinInput').value = '';
      $('#pinInput').focus();
    }
  }

  function showChangePinModal() {
    $('#pinOld').value = ''; $('#pinNew').value = ''; $('#pinConfirm').value = '';
    $('#changePinError').textContent = '';
    showOverlay('changePinModal');
  }

  function changePin() {
    const old = $('#pinOld').value, nw = $('#pinNew').value, cf = $('#pinConfirm').value;
    if (old !== getPin()) { $('#changePinError').textContent = 'รหัสเดิมไม่ถูกต้อง'; return; }
    if (nw.length < 4) { $('#changePinError').textContent = 'รหัสใหม่ต้องมีอย่างน้อย 4 ตัว'; return; }
    if (nw !== cf) { $('#changePinError').textContent = 'รหัสใหม่ไม่ตรงกัน'; return; }
    setPin(nw);
    hideOverlay('changePinModal');
    toast('เปลี่ยนรหัสสำเร็จ');
  }

  // ===== YOUTUBE HELPERS =====
  function getYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^&?\s]+)/);
    return m ? m[1] : null;
  }
  function getYouTubeThumb(url) { const id = getYouTubeId(url); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''; }
  function getEmbedUrl(url) { const id = getYouTubeId(url); return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : url; }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${type === 'success' ? '✓' : '✕'} ${msg}`;
    $('#toastContainer').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
  }

  // ===== RENDER =====
  function renderProfile(data) {
    const p = data.profile;
    $('#heroName').textContent = p.name;
    $('#heroTitle').textContent = p.title;
    $('#heroTagline').textContent = p.tagline;
    $('#footerName').textContent = p.name;
    $('#footerYear').textContent = new Date().getFullYear();
    const img = $('#avatarImg');
    if (p.avatar) { img.src = p.avatar; } else { img.src = ''; img.alt = p.name[0] || '?'; }
    $('#aboutText').innerHTML = `<p>${(p.about || '').replace(/\n/g, '</p><p>')}</p>`;
    $('#statProjects').textContent = p.projects || 0;
    $('#statExp').textContent = p.exp || 0;
    $('#statClients').textContent = p.clients || 0;
    renderContact(data);
  }

  function renderSkills(data) {
    const grid = $('#skillsGrid');
    if (!data.skills.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div><p>ยังไม่มีทักษะ</p></div>'; return; }
    grid.innerHTML = data.skills.map(s => `
      <div class="skill-item">
        <div class="work-card-actions"><button class="card-action-btn" onclick="App.editSkill('${s.id}')">✎</button><button class="card-action-btn delete" onclick="App.deleteItem('skills','${s.id}')">✕</button></div>
        <div class="skill-icon">${s.icon && (s.icon.startsWith('data:') || s.icon.startsWith('http') || s.icon.startsWith('assets/')) ? `<img src="${s.icon}" alt="${s.name}">` : (s.icon || '🎯')}</div>
        <div class="skill-name">${s.name}</div>
        <div class="skill-bar"><div class="skill-bar-fill" data-level="${s.level}"></div></div>
      </div>`).join('');
    setTimeout(() => $$('.skill-bar-fill').forEach(el => el.style.width = el.dataset.level + '%'), 300);
  }

  function renderWorks(data, filter = 'all') {
    const cats = [...new Set(data.works.map(w => w.category))];
    $('#filterTabs').innerHTML = `<button class="filter-tab ${filter === 'all' ? 'active' : ''}" onclick="App.filterWorks('all')">ทั้งหมด</button>` +
      cats.map(c => `<button class="filter-tab ${filter === c ? 'active' : ''}" onclick="App.filterWorks('${c}')">${c}</button>`).join('');
    const items = filter === 'all' ? data.works : data.works.filter(w => w.category === filter);
    const grid = $('#worksGrid');
    if (!items.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🖼️</div><p>ยังไม่มีผลงาน — กดปุ่ม ⚙ แล้วใส่รหัสเพื่อเพิ่มผลงาน</p></div>'; return; }
    grid.innerHTML = items.map(w => `
      <div class="work-card" onclick="App.openLightbox('${w.id}')">
        <div class="work-card-actions"><button class="card-action-btn" onclick="event.stopPropagation();App.editWork('${w.id}')">✎</button><button class="card-action-btn delete" onclick="event.stopPropagation();App.deleteItem('works','${w.id}')">✕</button></div>
        <div class="work-card-img">${w.image ? `<img src="${w.image}" alt="${w.title}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-muted)">🖼️</div>`}<div class="work-card-overlay"></div></div>
        <div class="work-card-body"><div class="work-card-category">${w.category}</div><div class="work-card-title">${w.title}</div><div class="work-card-desc">${w.desc || ''}</div></div>
      </div>`).join('');
  }

  function renderVideos(data) {
    const grid = $('#videoGrid');
    if (!data.videos.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🎬</div><p>ยังไม่มีวิดีโอ</p></div>'; return; }
    grid.innerHTML = data.videos.map(v => {
      const thumb = v.thumbnail || getYouTubeThumb(v.url);
      return `<div class="video-card" onclick="App.playVideo('${v.id}')">
        <div class="video-card-actions"><button class="card-action-btn" onclick="event.stopPropagation();App.editVideo('${v.id}')">✎</button><button class="card-action-btn delete" onclick="event.stopPropagation();App.deleteItem('videos','${v.id}')">✕</button></div>
        <div class="video-thumb">${thumb ? `<img src="${thumb}" alt="${v.title}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;background:var(--bg-secondary)">🎬</div>`}<div class="video-play-btn">▶</div></div>
        <div class="video-card-body"><div class="video-card-title">${v.title}</div><div class="video-card-desc">${v.desc || ''}</div></div>
      </div>`;
    }).join('');
  }

  function renderContact(data) {
    const p = data.profile;
    const items = [];
    const iconHtml = (img, fallback) => img && (img.startsWith('data:') || img.startsWith('http') || img.startsWith('assets/')) ? `<img src="${img}" alt="">` : fallback;
    if (p.email) items.push({ icon: iconHtml(p.emailIcon, '✉️'), label: 'Email', value: p.email, href: `mailto:${p.email}` });
    if (p.phone) items.push({ icon: iconHtml(p.phoneIcon, '📱'), label: 'โทรศัพท์', value: p.phone, href: `tel:${p.phone}` });
    if (p.facebook) items.push({ icon: iconHtml(p.facebookIcon, '👤'), label: 'Facebook', value: 'Facebook', href: p.facebook });
    if (p.instagram) items.push({ icon: iconHtml(p.instagramIcon, '📸'), label: 'Instagram', value: 'Instagram', href: p.instagram });
    if (p.youtube) items.push({ icon: iconHtml(p.youtubeIcon, '▶️'), label: 'YouTube', value: 'YouTube', href: p.youtube });
    const grid = $('#contactGrid');
    grid.innerHTML = items.map(c => `<a class="contact-card" href="${c.href}" target="_blank" rel="noopener"><div class="contact-icon">${c.icon}</div><div class="contact-label">${c.label}</div><div class="contact-value">${c.value}</div></a>`).join('');
    if (state.adminMode) grid.innerHTML += `<div class="contact-card" style="cursor:pointer;border-style:dashed" onclick="App.openProfileModal()"><div class="contact-icon">✏️</div><div class="contact-label">Admin</div><div class="contact-value">แก้ไขโปรไฟล์</div></div>`;
  }

  function renderAll() {
    const data = load();
    if (!data) return;
    renderProfile(data); renderSkills(data); renderWorks(data); renderVideos(data);
  }

  // ===== ADMIN MODE =====
  function toggleAdmin() {
    if (!state.adminMode) {
      showPinModal();
    } else {
      deactivateAdmin();
    }
  }

  function activateAdmin() {
    state.adminMode = true;
    document.body.classList.add('admin-mode');
    $('#adminToggle').classList.add('active');
    $('#adminToolbar').style.display = 'flex';
    toast('เปิด Admin Mode — สามารถเพิ่ม/แก้ไข/ลบผลงานได้');
    const heroEl = $('#heroAvatar');
    if (!heroEl.querySelector('.admin-edit-profile')) {
      const btn = document.createElement('button');
      btn.className = 'card-action-btn admin-edit-profile';
      btn.style.cssText = 'position:absolute;top:-4px;right:-4px;z-index:5';
      btn.textContent = '✎';
      btn.onclick = () => openProfileModal();
      heroEl.appendChild(btn);
    }
    renderContact(load());
  }

  function deactivateAdmin() {
    state.adminMode = false;
    document.body.classList.remove('admin-mode');
    $('#adminToggle').classList.remove('active');
    $('#adminToolbar').style.display = 'none';
    const eb = $('.admin-edit-profile');
    if (eb) eb.remove();
    toast('ปิด Admin Mode');
    renderContact(load());
  }

  // ===== MODALS =====
  function openModal(type, id = null) {
    state.editingType = type; state.editingId = id; state.tempImage = null;
    const data = load(); let title = '', fields = '';
    if (type === 'work') {
      const item = id ? data.works.find(w => w.id === id) : null;
      title = id ? 'แก้ไขผลงาน' : 'เพิ่มผลงานใหม่';
      fields = `
        <div class="form-group"><label class="form-label">ชื่อผลงาน</label><input class="form-input" id="fTitle" required value="${item?.title || ''}"></div>
        <div class="form-group"><label class="form-label">หมวดหมู่</label><input class="form-input" id="fCategory" placeholder="เช่น Graphic Design, UI/UX, Logo" value="${item?.category || ''}"></div>
        <div class="form-group"><label class="form-label">รายละเอียด</label><textarea class="form-textarea" id="fDesc">${item?.desc || ''}</textarea></div>
        <div class="form-group"><label class="form-label">รูปภาพ</label><input class="form-input" id="fImageUrl" placeholder="URL รูปภาพ (https://...)" value="${item?.image && !item.image.startsWith('data:') ? item.image : ''}">
        <label class="form-file-label" style="margin-top:8px" id="fImageLabel">📁 หรืออัพโหลดรูป<input type="file" accept="image/*" class="form-file" id="fImageFile" onchange="App.previewFile(this,'fImagePreview','fImageLabel')"></label>
        <div class="form-preview" id="fImagePreview">${item?.image ? `<img src="${item.image}">` : ''}</div></div>`;
    } else if (type === 'video') {
      const item = id ? data.videos.find(v => v.id === id) : null;
      title = id ? 'แก้ไขวิดีโอ' : 'เพิ่มวิดีโอใหม่';
      fields = `
        <div class="form-group"><label class="form-label">ชื่อวิดีโอ</label><input class="form-input" id="fTitle" required value="${item?.title || ''}"></div>
        <div class="form-group"><label class="form-label">YouTube URL</label><input class="form-input" id="fVideoUrl" placeholder="https://youtube.com/watch?v=..." value="${item?.url || ''}"></div>
        <div class="form-group"><label class="form-label">รายละเอียด</label><textarea class="form-textarea" id="fDesc">${item?.desc || ''}</textarea></div>
        <div class="form-group"><label class="form-label">Thumbnail (ถ้าไม่ใส่จะใช้จาก YouTube)</label><input class="form-input" id="fImageUrl" placeholder="URL รูป thumbnail" value="${item?.thumbnail || ''}"></div>`;
    } else if (type === 'skill') {
      const item = id ? data.skills.find(s => s.id === id) : null;
      title = id ? 'แก้ไขทักษะ' : 'เพิ่มทักษะใหม่';
      fields = `
        <div class="form-group"><label class="form-label">ชื่อทักษะ</label><input class="form-input" id="fTitle" required value="${item?.name || ''}"></div>
        <div class="form-group"><label class="form-label">ไอคอน (อัพโหลดรูป หรือ URL)</label>
          <input class="form-input" id="fIconUrl" placeholder="URL รูปไอคอน (https://...)" value="${item?.icon && !item.icon.startsWith('data:') ? item.icon : ''}">
          <label class="form-file-label" style="margin-top:8px" id="fIconLabel">📁 อัพโหลดรูปไอคอน<input type="file" accept="image/*" class="form-file" id="fIconFile" onchange="App.previewFile(this,'fIconPreview','fIconLabel')"></label>
          <div class="form-preview" id="fIconPreview">${item?.icon ? `<img src="${item.icon}" style="max-height:80px;width:auto">` : ''}</div>
        </div>
        <div class="form-group"><label class="form-label">ระดับ (0-100)</label><input class="form-input" id="fLevel" type="number" min="0" max="100" value="${item?.level || 50}"></div>`;
    }
    $('#adminModalTitle').textContent = title;
    $('#adminFormFields').innerHTML = fields;
    showOverlay('adminModal');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = load(); const type = state.editingType; const id = state.editingId;
    if (type === 'work') {
      const item = {
        id: id || uid(), title: $('#fTitle').value, category: $('#fCategory')?.value || 'อื่นๆ', desc: $('#fDesc').value,
        image: state.tempImage || $('#fImageUrl')?.value || (id ? data.works.find(w => w.id === id)?.image : '') || ''
      };
      if (id) { const i = data.works.findIndex(w => w.id === id); if (i >= 0) data.works[i] = item; }
      else data.works.push(item);
      toast(id ? 'แก้ไขผลงานแล้ว' : 'เพิ่มผลงานใหม่แล้ว');
    } else if (type === 'video') {
      const item = { id: id || uid(), title: $('#fTitle').value, url: $('#fVideoUrl').value, desc: $('#fDesc').value, thumbnail: $('#fImageUrl')?.value || '' };
      if (id) { const i = data.videos.findIndex(v => v.id === id); if (i >= 0) data.videos[i] = item; }
      else data.videos.push(item);
      toast(id ? 'แก้ไขวิดีโอแล้ว' : 'เพิ่มวิดีโอใหม่แล้ว');
    } else if (type === 'skill') {
      const iconValue = state.tempImage || ($('#fIconUrl')?.value) || (id ? data.skills.find(s => s.id === id)?.icon : '') || '';
      const item = { id: id || uid(), name: $('#fTitle').value, icon: iconValue, level: parseInt($('#fLevel').value) || 50 };
      if (id) { const i = data.skills.findIndex(s => s.id === id); if (i >= 0) data.skills[i] = item; }
      else data.skills.push(item);
      toast(id ? 'แก้ไขทักษะแล้ว' : 'เพิ่มทักษะใหม่แล้ว');
    }
    save(data); closeModal(); renderAll();
  }

  function deleteItem(type, id) {
    state.pendingDelete = { type, id };
    $('#confirmText').textContent = 'ต้องการลบรายการนี้?';
    showOverlay('confirmModal');
  }

  function confirmDelete() {
    if (!state.pendingDelete) return;
    const { type, id } = state.pendingDelete;
    const data = load();
    data[type] = data[type].filter(i => i.id !== id);
    save(data); renderAll(); toast('ลบเรียบร้อย');
    state.pendingDelete = null;
    hideOverlay('confirmModal');
  }

  function cancelDelete() {
    state.pendingDelete = null;
    hideOverlay('confirmModal');
  }

  function editWork(id) { openModal('work', id); }
  function editVideo(id) { openModal('video', id); }
  function editSkill(id) { openModal('skill', id); }
  function closeModal() { hideOverlay('adminModal'); state.editingId = null; state.editingType = null; state.tempImage = null; }

  // ===== PROFILE =====
  function openProfileModal() {
    state.contactIcons = {};
    const p = load().profile;
    $('#pName').value = p.name || ''; $('#pTitle').value = p.title || '';
    $('#pTagline').value = p.tagline || ''; $('#pAbout').value = p.about || '';
    $('#pAvatarUrl').value = (p.avatar && !p.avatar.startsWith('data:')) ? p.avatar : '';
    $('#pProjects').value = p.projects || 0; $('#pExp').value = p.exp || 0; $('#pClients').value = p.clients || 0;
    $('#pEmail').value = p.email || ''; $('#pPhone').value = p.phone || '';
    $('#pFacebook').value = p.facebook || ''; $('#pInstagram').value = p.instagram || '';
    $('#pYoutube').value = p.youtube || '';
    $('#pAvatarPreview').innerHTML = p.avatar ? `<img src="${p.avatar}">` : '';
    // Load existing icon URLs
    const iconUrlVal = (val) => val && !val.startsWith('data:') ? val : '';
    $('#pEmailIconUrl').value = iconUrlVal(p.emailIcon);
    $('#pPhoneIconUrl').value = iconUrlVal(p.phoneIcon);
    $('#pFacebookIconUrl').value = iconUrlVal(p.facebookIcon);
    $('#pInstagramIconUrl').value = iconUrlVal(p.instagramIcon);
    $('#pYoutubeIconUrl').value = iconUrlVal(p.youtubeIcon);
    showOverlay('profileModal');
  }
  function closeProfileModal() { hideOverlay('profileModal'); state.tempImage = null; state.contactIcons = {}; }
  function saveProfile(e) {
    e.preventDefault();
    const data = load();
    const ci = state.contactIcons || {};
    data.profile = {
      ...data.profile,
      name: $('#pName').value, title: $('#pTitle').value, tagline: $('#pTagline').value, about: $('#pAbout').value,
      avatar: state.tempImage || $('#pAvatarUrl').value || data.profile.avatar || '',
      projects: parseInt($('#pProjects').value) || 0, exp: parseInt($('#pExp').value) || 0, clients: parseInt($('#pClients').value) || 0,
      email: $('#pEmail').value, phone: $('#pPhone').value,
      facebook: $('#pFacebook').value, instagram: $('#pInstagram').value, youtube: $('#pYoutube').value,
      emailIcon: ci.pEmailIconUrl || $('#pEmailIconUrl').value || data.profile.emailIcon || '',
      phoneIcon: ci.pPhoneIconUrl || $('#pPhoneIconUrl').value || data.profile.phoneIcon || '',
      facebookIcon: ci.pFacebookIconUrl || $('#pFacebookIconUrl').value || data.profile.facebookIcon || '',
      instagramIcon: ci.pInstagramIconUrl || $('#pInstagramIconUrl').value || data.profile.instagramIcon || '',
      youtubeIcon: ci.pYoutubeIconUrl || $('#pYoutubeIconUrl').value || data.profile.youtubeIcon || ''
    };
    save(data); closeProfileModal(); renderAll(); toast('บันทึกโปรไฟล์แล้ว');
  }

  // ===== FILE UPLOAD =====
  function previewFile(input, previewId, labelId) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.tempImage = e.target.result;
      $(`#${previewId}`).innerHTML = `<img src="${e.target.result}">`;
      $(`#${labelId}`).classList.add('has-file');
      $(`#${labelId}`).innerHTML = `📁 ${file.name}` + input.outerHTML;
      $(`#${labelId} input`).onchange = function () { previewFile(this, previewId, labelId); };
    };
    reader.readAsDataURL(file);
  }

  function handleContactIcon(input, urlInputId, labelId) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!state.contactIcons) state.contactIcons = {};
      state.contactIcons[urlInputId] = e.target.result;
      $(`#${urlInputId}`).value = '';
      const lbl = $(`#${labelId}`);
      lbl.classList.add('has-file');
      lbl.innerHTML = `✓ ${file.name}` + input.outerHTML;
      $(`#${labelId} input`).onchange = function () { handleContactIcon(this, urlInputId, labelId); };
    };
    reader.readAsDataURL(file);
  }

  // ===== LIGHTBOX =====
  function openLightbox(id) {
    const w = load().works.find(i => i.id === id);
    if (!w || !w.image) return;
    $('#lightboxImg').src = w.image;
    $('#lightboxTitle').textContent = w.title;
    $('#lightboxDesc').textContent = w.desc || '';
    $('#lightbox').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { $('#lightbox').classList.remove('show'); document.body.style.overflow = ''; }

  // ===== VIDEO PLAYER =====
  function playVideo(id) {
    const v = load().videos.find(i => i.id === id);
    if (!v) return;
    $('#videoModalTitle').textContent = v.title;
    $('#videoIframe').src = getEmbedUrl(v.url);
    showOverlay('videoModal');
  }
  function closeVideoModal() { hideOverlay('videoModal'); $('#videoIframe').src = ''; }

  function showOverlay(id) { const el = $(`#${id}`); el.style.display = 'flex'; requestAnimationFrame(() => el.classList.add('show')); document.body.style.overflow = 'hidden'; }
  function hideOverlay(id) { const el = $(`#${id}`); el.classList.remove('show'); setTimeout(() => { el.style.display = 'none'; }, 300); document.body.style.overflow = ''; }

  function filterWorks(cat) { renderWorks(load(), cat); }

  // ===== SCROLL & NAV =====
  function initScroll() {
    const nav = $('#navbar');
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 50));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    $$('.reveal').forEach(el => obs.observe(el));
    $$('.nav-links a').forEach(a => {
      a.addEventListener('click', function () {
        $$('.nav-links a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        $('#navLinks').classList.remove('open');
      });
    });
  }

  async function init() {
    await initData();
    renderAll(); initScroll();
    $('#adminToggle').addEventListener('click', toggleAdmin);
    $('#hamburger').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeLightbox(); closeVideoModal(); closeModal(); closeProfileModal(); hideOverlay('pinModal'); hideOverlay('changePinModal'); }
    });
    $$('.modal-overlay').forEach(el => {
      el.addEventListener('click', e => { if (e.target === el) { closeModal(); closeProfileModal(); closeVideoModal(); hideOverlay('pinModal'); hideOverlay('changePinModal'); } });
    });
    $('#pinForm').addEventListener('submit', e => { e.preventDefault(); verifyPin(); });
    $('#changePinForm').addEventListener('submit', e => { e.preventDefault(); changePin(); });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    openModal, closeModal, handleSubmit, deleteItem,
    editWork, editVideo, editSkill, filterWorks,
    openLightbox, closeLightbox, playVideo, closeVideoModal,
    openProfileModal, closeProfileModal, saveProfile, previewFile,
    exportData, importData, showChangePinModal,
    confirmDelete, cancelDelete, handleContactIcon
  };
})();
