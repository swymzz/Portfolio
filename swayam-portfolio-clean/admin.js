/* ============================================================
   ADMIN.JS — Full CMS: CRUD for all sections + Supabase
              Storage file uploads (video, audio, 3D model)
   ============================================================
   NOTE: Before file uploads work, create a PUBLIC bucket
   named "portfolio-media" in your Supabase Storage dashboard.
   ============================================================ */

(async function () {

  /* ── Supabase ─────────────────────────────────────── */
  var SUPABASE_URL = 'https://zctfnbiexqzbnjrhgkjq.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdGZuYmlleHF6Ym5qcmhna2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDA0MTUsImV4cCI6MjA5NzExNjQxNX0.N0CLFdvGQ7n0_rqavqZDEmxdC2n7OfJ2EfxQRGhWbMY';
  var ADMIN_EMAIL  = 'swayamk2105@gmail.com';
  var BUCKET       = 'portfolio-media';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ── State ────────────────────────────────────────── */
  var defaults = window.PORTFOLIO_DEFAULT_CONTENT;
  var content  = clone(defaults);
  var selectedProjectId = null;
  var selectedLyricId   = null;
  var selectedVideoIdx  = 0;
  var selectedModelIdx  = 0;
  var selectedTrackIdx  = 0;
  var activeSection     = 'profile';

  /* ── Utils ────────────────────────────────────────── */
  function clone(v)  { return JSON.parse(JSON.stringify(v)); }
  function $id(id)   { return document.getElementById(id); }
  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function slugify(v) {
    return String(v||'item').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  }
  function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2,7); }

  /* ── Toast ────────────────────────────────────────── */
  function toast(msg, type) {
    var el = $id('toast');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'toast visible' + (type ? ' ' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('visible'); }, 3000);
  }

  /* ── Supabase data ────────────────────────────────── */
  async function loadContent() {
    try {
      var res = await sb.from('portfolio_data').select('content').eq('id',1).single();
      if (res.data && res.data.content) {
        content = Object.assign(clone(defaults), res.data.content);
      }
    } catch (e) { /* use defaults */ }
  }

  async function saveContent() {
    toast('Saving…');
    var res = await sb.from('portfolio_data').upsert({ id: 1, content: content });
    if (res.error) { toast('Save failed: ' + res.error.message, 'error'); }
    else           { toast('Live database updated! ✓', 'success'); }
  }

  /* ── Supabase Storage Upload ──────────────────────── */
  async function uploadFile(file, folder, progressEl) {
    var ext  = file.name.split('.').pop().toLowerCase();
    var path = folder + '/' + uid() + '.' + ext;
    if (progressEl) showProgress(progressEl, 10);

    var res = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type
    });

    if (res.error) {
      if (progressEl) hideProgress(progressEl);
      toast('Upload failed: ' + res.error.message, 'error');
      return null;
    }
    if (progressEl) showProgress(progressEl, 100);
    setTimeout(function () { if (progressEl) hideProgress(progressEl); }, 1200);

    var pub = sb.storage.from(BUCKET).getPublicUrl(path);
    return pub.data.publicUrl;
  }

  function showProgress(el, pct) {
    el.classList.add('visible');
    var fill  = el.querySelector('.progress-bar-fill');
    var label = el.querySelector('.progress-label');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = pct < 100 ? 'Uploading… ' + pct + '%' : 'Upload complete ✓';
  }
  function hideProgress(el) {
    el.classList.remove('visible');
    var fill = el.querySelector('.progress-bar-fill');
    if (fill) fill.style.width = '0%';
  }

  /* Upload Zone builder */
  function buildUploadZone(id, accept, folder, onUrlReady) {
    var zoneId = 'zone-' + id;
    var progId = 'prog-' + id;
    var html = [
      '<div class="upload-zone" id="' + zoneId + '">',
      '<span class="upload-icon">&#8679;</span>',
      '<p>Drop file here or click to browse</p>',
      '<small>Accepted: ' + esc(accept) + '</small>',
      '<input type="file" accept="' + esc(accept) + '" id="file-' + id + '" />',
      '</div>',
      '<div class="upload-progress" id="' + progId + '">',
      '<div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>',
      '<p class="progress-label">Uploading…</p>',
      '</div>'
    ].join('');

    /* Attach events after render */
    setTimeout(function () {
      var zone    = $id(zoneId);
      var fileInp = $id('file-' + id);
      var progEl  = $id(progId);
      if (!zone || !fileInp) return;

      zone.addEventListener('dragover',  function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', function ()   { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', async function (e) {
        e.preventDefault(); zone.classList.remove('drag-over');
        var f = e.dataTransfer.files[0];
        if (f) { var url = await uploadFile(f, folder, progEl); if (url) onUrlReady(url); }
      });

      fileInp.addEventListener('change', async function () {
        var f = fileInp.files[0];
        if (f) { var url = await uploadFile(f, folder, progEl); if (url) onUrlReady(url); }
      });
    }, 50);

    return html;
  }

  /* ── Section Navigation ───────────────────────────── */
  function showSection(name) {
    activeSection = name;
    document.querySelectorAll('.admin-section').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.admin-nav-btn').forEach(function (btn) { btn.classList.remove('active'); });
    var sec = $id('section-' + name);
    if (sec) sec.classList.add('active');
    var btn = document.querySelector('[data-section="' + name + '"]');
    if (btn) btn.classList.add('active');
    var titleMap = {
      profile:'Profile', hero:'Hero & Stats', sitetext:'Site Text & Nav', projects:'Projects',
      videos:'Videos', models:'3D Models', music:'Music & Audio',
      lyrics:'Lyrics', about:'About & Timeline', skills:'Skills & Tags', marquee:'Marquee'
    };
    var titleEl = $id('section-title');
    if (titleEl) titleEl.textContent = titleMap[name] || name;
    renderSection(name);
  }

  function renderSection(name) {
    var fn = {
      profile:  renderProfileSection,
      hero:     renderHeroSection,
      sitetext: renderSiteTextSection,
      projects: renderProjectsSection,
      videos:   renderVideosSection,
      models:   renderModelsSection,
      music:    renderMusicSection,
      lyrics:   renderLyricsSection,
      about:    renderAboutSection,
      skills:   renderSkillsSection,
      marquee:  renderMarqueeSection,
    };
    if (fn[name]) fn[name]();
  }

  /* ── SECTION: PROFILE ─────────────────────────────── */
  function renderProfileSection() {
    var p = content.profile || {};
    var el = $id('profile-form-grid');
    if (!el) return;
    el.innerHTML = [
      fg('Name',           'p-name',         p.name,           'text'),
      fg('Brand Initials', 'p-brand',        p.brandInitials,  'text', '', 'e.g. SK'),
      fg('Email',          'p-email',        p.email,          'email'),
      fg('Location',       'p-location',     p.location,       'text'),
      fg('GitHub URL',     'p-github',       p.github,         'url'),
      fg('LinkedIn URL',   'p-linkedin',     p.linkedin,       'url'),
      fg('Resume URL',     'p-resumeUrl',    p.resumeUrl,      'url'),
      fgTA('Title (subtitle under name)', 'p-title',    p.title,   4, 'form-full'),
      fgTA('Hero Intro paragraph',        'p-intro',    p.intro,   4, 'form-full'),
      fgTA('Contact Line',                'p-contactLine', p.contactLine, 3, 'form-full'),
    ].join('');
    bindLive(el, ['p-name','p-brand','p-email','p-location','p-github','p-linkedin','p-resumeUrl','p-title','p-intro','p-contactLine'], function (values) {
      content.profile.name          = values['p-name']        || '';
      content.profile.brandInitials = values['p-brand']       || '';
      content.profile.email         = values['p-email']       || '';
      content.profile.location      = values['p-location']    || '';
      content.profile.github        = values['p-github']      || '';
      content.profile.linkedin      = values['p-linkedin']    || '';
      content.profile.resumeUrl     = values['p-resumeUrl']   || '';
      content.profile.title         = values['p-title']       || '';
      content.profile.intro         = values['p-intro']       || '';
      content.profile.contactLine   = values['p-contactLine'] || '';
    });
  }

  /* ── SECTION: HERO ────────────────────────────────── */
  function renderHeroSection() {
    var h  = content.hero || {};
    var el = $id('hero-form-grid');
    if (el) {
      el.innerHTML = [
        fg('Eyebrow text',    'h-eyebrow', h.eyebrow,   'text'),
        fg('CTA 1 Label',     'h-cta1l',   h.cta1Label, 'text'),
        fg('CTA 1 Link',      'h-cta1h',   h.cta1Href,  'text'),
        fg('CTA 2 Label',     'h-cta2l',   h.cta2Label, 'text'),
        fg('CTA 2 Link',      'h-cta2h',   h.cta2Href,  'text'),
      ].join('');
      bindLive(el, ['h-eyebrow','h-cta1l','h-cta1h','h-cta2l','h-cta2h'], function (v) {
        content.hero.eyebrow   = v['h-eyebrow'] || '';
        content.hero.cta1Label = v['h-cta1l']   || '';
        content.hero.cta1Href  = v['h-cta1h']   || '';
        content.hero.cta2Label = v['h-cta2l']   || '';
        content.hero.cta2Href  = v['h-cta2h']   || '';
      });
    }
    renderStatsAdmin();
  }

  /* ── SECTION: SITE TEXT & NAV ─────────────────────── */
  function renderSiteTextSection() {
    var p  = content.profile  || {};
    var h  = content.hero     || {};
    var n  = content.nav      || {};
    var s  = content.sections || {};
    var sw = s.work    || {};  var sl = s.lab     || {};
    var ss = s.studio  || {};  var sm = s.music   || {};
    var sa = s.about   || {};  var sc = s.contact || {};

    /* Pre-fill all inputs */
    function setVal(id, v) { var el = $id(id); if (el) el.value = v || ''; }
    /* Header / brand */
    setVal('st-brand',        p.brandInitials || '');
    setVal('st-panel-label',  h.panelLabel    || '');
    setVal('st-panel-value',  h.panelValue    || '');
    /* Nav */
    setVal('st-nav-work',     n.work       || '');
    setVal('st-nav-lab',      n.lab        || '');
    setVal('st-nav-studio',   n.studio     || '');
    setVal('st-nav-music',    n.music      || '');
    setVal('st-nav-about',    n.about      || '');
    setVal('st-nav-contact',  n.contactBtn || '');
    /* Work */
    setVal('st-work-eyebrow', sw.eyebrow || '');
    setVal('st-work-heading', sw.heading || '');
    setVal('st-work-lead',    sw.lead    || '');
    /* Lab */
    setVal('st-lab-eyebrow',  sl.eyebrow || '');
    setVal('st-lab-heading',  sl.heading || '');
    setVal('st-lab-lead',     sl.lead    || '');
    /* Studio */
    setVal('st-studio-eyebrow', ss.eyebrow || '');
    setVal('st-studio-heading', ss.heading || '');
    setVal('st-studio-lead',    ss.lead    || '');
    /* Music */
    setVal('st-music-eyebrow', sm.eyebrow     || '');
    setVal('st-music-heading', sm.heading     || '');
    setVal('st-music-lead',    sm.lead        || '');
    setVal('st-music-tracks',  sm.tracksLabel || '');
    setVal('st-music-lyrics',  sm.lyricsLabel || '');
    /* About */
    setVal('st-about-eyebrow', sa.eyebrow || '');
    setVal('st-about-heading', sa.heading || '');
    /* Contact */
    setVal('st-contact-eyebrow', sc.eyebrow || '');
    setVal('st-contact-heading', sc.heading || '');

    /* Live-bind all inputs */
    function liveInput(id, writer) {
      var el = $id(id);
      if (el) el.addEventListener('input', function () { writer(el.value); });
    }
    /* Ensure nested objects exist */
    if (!content.profile.brandInitials !== undefined) {}
    if (!content.hero.panelLabel)      content.hero.panelLabel = '';
    if (!content.hero.panelValue)      content.hero.panelValue = '';
    if (!content.nav)      content.nav      = clone(defaults.nav      || {});
    if (!content.sections) content.sections = clone(defaults.sections || {});
    ['work','lab','studio','music','about','contact'].forEach(function (k) {
      if (!content.sections[k]) content.sections[k] = clone((defaults.sections || {})[k] || {});
    });

    liveInput('st-brand',           function (v) { content.profile.brandInitials = v; });
    liveInput('st-panel-label',     function (v) { content.hero.panelLabel = v; });
    liveInput('st-panel-value',     function (v) { content.hero.panelValue = v; });

    liveInput('st-nav-work',        function (v) { content.nav.work       = v; });
    liveInput('st-nav-lab',         function (v) { content.nav.lab        = v; });
    liveInput('st-nav-studio',      function (v) { content.nav.studio     = v; });
    liveInput('st-nav-music',       function (v) { content.nav.music      = v; });
    liveInput('st-nav-about',       function (v) { content.nav.about      = v; });
    liveInput('st-nav-contact',     function (v) { content.nav.contactBtn = v; });

    liveInput('st-work-eyebrow',    function (v) { content.sections.work.eyebrow = v; });
    liveInput('st-work-heading',    function (v) { content.sections.work.heading = v; });
    liveInput('st-work-lead',       function (v) { content.sections.work.lead    = v; });

    liveInput('st-lab-eyebrow',     function (v) { content.sections.lab.eyebrow = v; });
    liveInput('st-lab-heading',     function (v) { content.sections.lab.heading = v; });
    liveInput('st-lab-lead',        function (v) { content.sections.lab.lead    = v; });

    liveInput('st-studio-eyebrow',  function (v) { content.sections.studio.eyebrow = v; });
    liveInput('st-studio-heading',  function (v) { content.sections.studio.heading = v; });
    liveInput('st-studio-lead',     function (v) { content.sections.studio.lead    = v; });

    liveInput('st-music-eyebrow',   function (v) { content.sections.music.eyebrow     = v; });
    liveInput('st-music-heading',   function (v) { content.sections.music.heading     = v; });
    liveInput('st-music-lead',      function (v) { content.sections.music.lead        = v; });
    liveInput('st-music-tracks',    function (v) { content.sections.music.tracksLabel = v; });
    liveInput('st-music-lyrics',    function (v) { content.sections.music.lyricsLabel = v; });

    liveInput('st-about-eyebrow',   function (v) { content.sections.about.eyebrow = v; });
    liveInput('st-about-heading',   function (v) { content.sections.about.heading = v; });

    liveInput('st-contact-eyebrow', function (v) { content.sections.contact.eyebrow = v; });
    liveInput('st-contact-heading', function (v) { content.sections.contact.heading = v; });
  }

  function renderStatsAdmin() {
    var el = $id('stats-admin-list');
    if (!el) return;
    var stats = content.stats || [];
    el.innerHTML = stats.map(function (s, i) {
      return [
        '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;border:1px solid var(--border);border-radius:var(--r-sm);padding:12px">',
        fg('Label', 's-label-' + i, s.label, 'text'),
        fg('Value', 's-value-' + i, s.value, 'text'),
        '<button class="btn btn-danger btn-sm" style="align-self:flex-end" data-del-stat="' + i + '">&#x2715;</button>',
        '</div>'
      ].join('');
    }).join('');

    /* Live bind stats */
    stats.forEach(function (s, i) {
      var lInp = $id('s-label-' + i);
      var vInp = $id('s-value-' + i);
      if (lInp) lInp.addEventListener('input', function () { s.label = lInp.value; });
      if (vInp) vInp.addEventListener('input', function () { s.value = vInp.value; });
    });

    el.querySelectorAll('[data-del-stat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.stats.splice(parseInt(btn.dataset.delStat), 1);
        renderStatsAdmin();
      });
    });
  }

  /* ── SECTION: PROJECTS ────────────────────────────── */
  function renderProjectsSection() {
    renderProjectList();
    renderProjectForm();
  }

  function renderProjectList() {
    var el = $id('project-list-admin');
    if (!el) return;
    el.innerHTML = (content.projects || []).map(function (p) {
      return '<button class="admin-list-item' + (p.id === selectedProjectId ? ' active' : '') + '" data-pid="' + esc(p.id) + '"><strong>' + esc(p.title) + '</strong><span>' + esc(p.category) + ' · ' + esc(p.status) + '</span></button>';
    }).join('');
    el.querySelectorAll('[data-pid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedProjectId = btn.dataset.pid;
        renderProjectsSection();
      });
    });
  }

  function renderProjectForm() {
    var form = $id('project-form-admin');
    if (!form) return;
    var p = (content.projects || []).find(function (x) { return x.id === selectedProjectId; });
    if (!p) { form.innerHTML = '<p style="color:var(--text-dim)">Select or add a project on the left.</p>'; return; }

    form.innerHTML = [
      fg('Title',       'pf-title',    p.title,   'text'),
      fg('Category',    'pf-cat',      p.category,'text'),
      fg('Status',      'pf-status',   p.status,  'text'),
      fg('Project URL', 'pf-url',      p.url,     'url'),
      fg('Highlight',   'pf-highlight',p.highlight,'text','form-full'),
      fgTA('Description', 'pf-desc',   p.description, 5, 'form-full'),
      fgTA('Tools (comma-separated)', 'pf-tools', (p.tools||[]).join(', '), 2, 'form-full'),
      fg('Thumbnail URL','pf-thumb',   p.thumbnail,'url','form-full'),
      '<div class="form-group form-full"><div class="checkbox-row"><input type="checkbox" id="pf-featured"' + (p.featured ? ' checked' : '') + ' /><label for="pf-featured" style="text-transform:none;letter-spacing:0;font-size:0.9rem">Featured project</label></div></div>',
      '<div class="form-full"><button class="btn btn-danger btn-sm" id="del-project-btn">Delete this project</button></div>'
    ].join('');

    bindLive(form, ['pf-title','pf-cat','pf-status','pf-url','pf-highlight','pf-desc','pf-tools','pf-thumb'], function (v) {
      p.title     = v['pf-title']    || '';
      p.category  = v['pf-cat']      || '';
      p.status    = v['pf-status']   || '';
      p.url       = v['pf-url']      || '';
      p.highlight = v['pf-highlight']|| '';
      p.description = v['pf-desc']   || '';
      p.tools     = splitCSV(v['pf-tools']);
      p.thumbnail = v['pf-thumb']    || '';
      renderProjectList();
    });
    var feat = $id('pf-featured');
    if (feat) feat.addEventListener('change', function () { p.featured = feat.checked; });

    var del = $id('del-project-btn');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Delete "' + p.title + '"?')) return;
      content.projects = content.projects.filter(function (x) { return x.id !== selectedProjectId; });
      selectedProjectId = (content.projects[0] || {}).id || null;
      renderProjectsSection();
      toast('Project deleted.', 'success');
    });
  }

  /* ── SECTION: VIDEOS ──────────────────────────────── */
  function renderVideosSection() {
    if (!content.videos || !content.videos.length) {
      content.videos = [{ id: uid(), title: 'New Video', type: 'YouTube', url: '', fileUrl: '', thumbnail: '', description: '' }];
      selectedVideoIdx = 0;
    }
    selectedVideoIdx = Math.min(selectedVideoIdx, content.videos.length - 1);
    buildMediaSelect('video-select', content.videos, selectedVideoIdx, function (i) {
      selectedVideoIdx = i; renderVideoForm();
    });
    renderVideoForm();
  }

  function renderVideoForm() {
    var wrap = $id('video-form-wrap');
    if (!wrap) return;
    var v = content.videos[selectedVideoIdx];
    if (!v) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = [
      '<div class="form-grid">',
      fg('Title',       'vf-title', v.title,       'text'),
      fg('Type',        'vf-type',  v.type,        'text', '', 'YouTube, Vimeo, Upload, etc.'),
      fg('YouTube / External URL', 'vf-url', v.url, 'url', 'form-full'),
      fg('Thumbnail URL (auto-filled for YouTube)', 'vf-thumb', v.thumbnail, 'url', 'form-full'),
      fgTA('Description', 'vf-desc', v.description, 3, 'form-full'),
      '</div>',
      '<div style="margin-top:4px">',
      '<p class="url-or">or upload a video file</p>',
      buildUploadZone('video-' + selectedVideoIdx, 'video/*,.mp4,.webm,.mov', 'videos', function (url) {
        v.fileUrl = url; var fInp = $id('vf-fileurl'); if (fInp) fInp.value = url; toast('Video uploaded ✓', 'success');
      }),
      '</div>',
      fg('Uploaded File URL (auto-filled)', 'vf-fileurl', v.fileUrl, 'url', 'form-full'),
    ].join('');

    bindLive(wrap, ['vf-title','vf-type','vf-url','vf-thumb','vf-desc','vf-fileurl'], function (val) {
      v.title       = val['vf-title']   || '';
      v.type        = val['vf-type']    || '';
      v.url         = val['vf-url']     || '';
      v.thumbnail   = val['vf-thumb']   || '';
      v.description = val['vf-desc']    || '';
      v.fileUrl     = val['vf-fileurl'] || '';
      buildMediaSelect('video-select', content.videos, selectedVideoIdx, function (i) {
        selectedVideoIdx = i; renderVideoForm();
      });
    });
  }

  /* ── SECTION: 3D MODELS ───────────────────────────── */
  function renderModelsSection() {
    if (!content.models || !content.models.length) {
      content.models = [{ id: uid(), title: 'New Model', format: 'GLB', url: '', fileUrl: '', thumbnail: '', description: '' }];
      selectedModelIdx = 0;
    }
    selectedModelIdx = Math.min(selectedModelIdx, content.models.length - 1);
    buildMediaSelect('model-select', content.models, selectedModelIdx, function (i) {
      selectedModelIdx = i; renderModelForm();
    });
    renderModelForm();
  }

  function renderModelForm() {
    var wrap = $id('model-form-wrap');
    if (!wrap) return;
    var m = content.models[selectedModelIdx];
    if (!m) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = [
      '<div class="form-grid">',
      fg('Title',    'mf-title',  m.title,  'text'),
      fg('Format',   'mf-format', m.format, 'text', '', 'GLB, GLTF, STL, STEP…'),
      fg('External Link (e.g. Sketchfab)', 'mf-url', m.url, 'url', 'form-full'),
      fgTA('Description', 'mf-desc', m.description, 3, 'form-full'),
      '</div>',
      '<div style="margin-top:4px">',
      '<p class="url-or">or upload a 3D model file (GLB/GLTF)</p>',
      buildUploadZone('model-' + selectedModelIdx, '.glb,.gltf', 'models', function (url) {
        m.fileUrl = url; var fInp = $id('mf-fileurl'); if (fInp) fInp.value = url; toast('Model uploaded ✓', 'success');
      }),
      '</div>',
      fg('Uploaded GLB/GLTF URL (auto-filled)', 'mf-fileurl', m.fileUrl, 'url', 'form-full'),
    ].join('');

    bindLive(wrap, ['mf-title','mf-format','mf-url','mf-desc','mf-fileurl'], function (val) {
      m.title       = val['mf-title']   || '';
      m.format      = val['mf-format']  || '';
      m.url         = val['mf-url']     || '';
      m.description = val['mf-desc']    || '';
      m.fileUrl     = val['mf-fileurl'] || '';
      buildMediaSelect('model-select', content.models, selectedModelIdx, function (i) {
        selectedModelIdx = i; renderModelForm();
      });
    });
  }

  /* ── SECTION: MUSIC ───────────────────────────────── */
  function renderMusicSection() {
    if (!content.tracks || !content.tracks.length) {
      content.tracks = [{ id: uid(), title: 'New Track', url: '', fileUrl: '', description: '' }];
      selectedTrackIdx = 0;
    }
    selectedTrackIdx = Math.min(selectedTrackIdx, content.tracks.length - 1);
    buildMediaSelect('track-select', content.tracks, selectedTrackIdx, function (i) {
      selectedTrackIdx = i; renderTrackForm();
    });
    renderTrackForm();
  }

  function renderTrackForm() {
    var wrap = $id('track-form-wrap');
    if (!wrap) return;
    var t = content.tracks[selectedTrackIdx];
    if (!t) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = [
      '<div class="form-grid">',
      fg('Title', 'tf-title', t.title, 'text'),
      fg('External Audio URL (MP3, SoundCloud, etc.)', 'tf-url', t.url, 'url', 'form-full'),
      fgTA('Description', 'tf-desc', t.description, 3, 'form-full'),
      '</div>',
      '<div style="margin-top:4px">',
      '<p class="url-or">or upload an audio file</p>',
      buildUploadZone('track-' + selectedTrackIdx, 'audio/*,.mp3,.wav,.ogg,.flac,.m4a', 'audio', function (url) {
        t.fileUrl = url; var fInp = $id('tf-fileurl'); if (fInp) fInp.value = url; toast('Audio uploaded ✓', 'success');
      }),
      '</div>',
      fg('Uploaded Audio URL (auto-filled)', 'tf-fileurl', t.fileUrl, 'url', 'form-full'),
    ].join('');

    bindLive(wrap, ['tf-title','tf-url','tf-desc','tf-fileurl'], function (val) {
      t.title       = val['tf-title']   || '';
      t.url         = val['tf-url']     || '';
      t.description = val['tf-desc']    || '';
      t.fileUrl     = val['tf-fileurl'] || '';
      buildMediaSelect('track-select', content.tracks, selectedTrackIdx, function (i) {
        selectedTrackIdx = i; renderTrackForm();
      });
    });
  }

  /* ── SECTION: LYRICS ──────────────────────────────── */
  function renderLyricsSection() {
    renderLyricList();
    renderLyricForm();
  }

  function renderLyricList() {
    var el = $id('lyric-list-admin');
    if (!el) return;
    el.innerHTML = (content.lyrics || []).map(function (l) {
      return '<button class="admin-list-item' + (l.id === selectedLyricId ? ' active' : '') + '" data-lid="' + esc(l.id) + '"><strong>' + esc(l.title) + '</strong><span>' + esc(l.mood) + '</span></button>';
    }).join('');
    el.querySelectorAll('[data-lid]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedLyricId = btn.dataset.lid;
        renderLyricsSection();
      });
    });
  }

  function renderLyricForm() {
    var form = $id('lyric-form-admin');
    if (!form) return;
    var l = (content.lyrics || []).find(function (x) { return x.id === selectedLyricId; });
    if (!l) { form.innerHTML = '<p style="color:var(--text-dim)">Select or add a lyric on the left.</p>'; return; }

    form.innerHTML = [
      fg('Title', 'lf-title', l.title, 'text'),
      fg('Mood / Tag', 'lf-mood', l.mood, 'text'),
      fgTA('Lyrics Text', 'lf-text', l.text, 10, 'form-full'),
      '<div class="form-full"><button class="btn btn-danger btn-sm" id="del-lyric-btn">Delete this lyric</button></div>'
    ].join('');

    bindLive(form, ['lf-title','lf-mood','lf-text'], function (v) {
      l.title = v['lf-title'] || '';
      l.mood  = v['lf-mood']  || '';
      l.text  = v['lf-text']  || '';
      renderLyricList();
    });

    var del = $id('del-lyric-btn');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Delete "' + l.title + '"?')) return;
      content.lyrics = content.lyrics.filter(function (x) { return x.id !== selectedLyricId; });
      selectedLyricId = (content.lyrics[0] || {}).id || null;
      renderLyricsSection();
      toast('Lyric deleted.', 'success');
    });
  }

  /* ── SECTION: ABOUT ───────────────────────────────── */
  function renderAboutSection() {
    var ta = $id('about-textarea');
    if (ta) {
      ta.value = content.profile.about || '';
      ta.addEventListener('input', function () { content.profile.about = ta.value; });
    }
    renderTimelineAdmin();
  }

  function renderTimelineAdmin() {
    var el = $id('timeline-admin-list');
    if (!el) return;
    el.innerHTML = (content.timeline || []).map(function (t, i) {
      return [
        '<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:18px;display:grid;gap:12px">',
        '<div class="form-grid">',
        fg('Title', 'tl-title-' + i, t.title, 'text'),
        fg('Meta (institution · dates)', 'tl-meta-' + i, t.meta, 'text'),
        fgTA('Description', 'tl-text-' + i, t.text, 3, 'form-full'),
        '</div>',
        '<button class="btn btn-danger btn-sm" style="justify-self:start" data-del-tl="' + i + '">Delete entry</button>',
        '</div>'
      ].join('');
    }).join('');

    (content.timeline || []).forEach(function (t, i) {
      bindLive(el, ['tl-title-'+i,'tl-meta-'+i,'tl-text-'+i], function (v) {
        t.title = v['tl-title-'+i] || '';
        t.meta  = v['tl-meta-'+i]  || '';
        t.text  = v['tl-text-'+i]  || '';
      });
    });

    el.querySelectorAll('[data-del-tl]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        content.timeline.splice(parseInt(btn.dataset.delTl), 1);
        renderTimelineAdmin();
      });
    });
  }

  /* ── SECTION: SKILLS & TAGS ───────────────────────── */
  function renderSkillsSection() {
    var tagsTA  = $id('tags-textarea');
    var skillTA = $id('skills-textarea');
    if (tagsTA) {
      tagsTA.value = (content.tags || []).join(', ');
      tagsTA.addEventListener('input', function () { content.tags = splitCSV(tagsTA.value); });
    }
    if (skillTA) {
      skillTA.value = (content.skills || []).join(', ');
      skillTA.addEventListener('input', function () { content.skills = splitCSV(skillTA.value); });
    }
  }

  /* ── SECTION: MARQUEE ─────────────────────────────── */
  function renderMarqueeSection() {
    var ta = $id('marquee-textarea');
    if (ta) {
      ta.value = (content.marqueeItems || []).slice(0, Math.ceil((content.marqueeItems||[]).length / 2)).join(', ');
      ta.addEventListener('input', function () {
        var items = splitCSV(ta.value);
        /* Duplicate for seamless loop */
        content.marqueeItems = [...items, ...items];
      });
    }
  }



  /* ── Helper: build a <select> for a media collection ─ */
  function buildMediaSelect(selectId, collection, activeIdx, onChange) {
    var sel = $id(selectId);
    if (!sel) return;
    sel.innerHTML = collection.map(function (item, i) {
      return '<option value="' + i + '"' + (i === activeIdx ? ' selected' : '') + '>' + esc(item.title || ('Item ' + (i+1))) + '</option>';
    }).join('');
    sel.onchange = function () { onChange(parseInt(sel.value)); };
  }

  /* ── HTML Field Builders ──────────────────────────── */
  function fg(label, id, value, type, extra, placeholder) {
    return [
      '<div class="form-group' + (extra ? ' ' + extra : '') + '">',
      '<label for="' + id + '">' + esc(label) + '</label>',
      '<input id="' + id + '" type="' + (type||'text') + '" value="' + esc(value||'') + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + ' />',
      '</div>'
    ].join('');
  }
  function fgTA(label, id, value, rows, extra) {
    return [
      '<div class="form-group' + (extra ? ' ' + extra : '') + '">',
      '<label for="' + id + '">' + esc(label) + '</label>',
      '<textarea id="' + id + '" rows="' + (rows||4) + '">' + esc(value||'') + '</textarea>',
      '</div>'
    ].join('');
  }

  /* ── Live bind inputs ─────────────────────────────── */
  function bindLive(container, ids, callback) {
    ids.forEach(function (id) {
      var el = (typeof container === 'string') ? $id(id) : container.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', function () {
        var values = {};
        ids.forEach(function (i) {
          var e = (typeof container === 'string') ? $id(i) : container.querySelector('#' + i);
          values[i] = e ? e.value : '';
        });
        callback(values);
      });
    });
  }

  /* ── CSV Split ────────────────────────────────────── */
  function splitCSV(v) {
    return String(v||'').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ── BIND ALL TOP-LEVEL ACTIONS ───────────────────── */
  function bindActions() {
    /* Nav buttons */
    document.querySelectorAll('.admin-nav-btn[data-section]').forEach(function (btn) {
      btn.addEventListener('click', function () { showSection(btn.dataset.section); });
    });

    /* Save */
    var saveBtn = $id('save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveContent);

    /* Export */
    var expBtn = $id('export-btn');
    if (expBtn) expBtn.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'swayam-portfolio-content.json'; a.click();
      URL.revokeObjectURL(a.href);
      toast('JSON exported.', 'success');
    });

    /* Import */
    var impInp = $id('import-input');
    if (impInp) impInp.addEventListener('change', function () {
      var f = impInp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          content = Object.assign(clone(defaults), JSON.parse(r.result));
          selectedProjectId = (content.projects[0]||{}).id || null;
          selectedLyricId   = (content.lyrics[0]  ||{}).id || null;
          showSection(activeSection);
          toast('JSON imported ✓', 'success');
        } catch (e) { toast('Invalid JSON file.', 'error'); }
      };
      r.readAsText(f);
    });

    /* Reset */
    var rstBtn = $id('reset-btn');
    if (rstBtn) rstBtn.addEventListener('click', async function () {
      if (!confirm('Reset all content to defaults and push to database?')) return;
      content = clone(defaults);
      var res = await sb.from('portfolio_data').upsert({ id: 1, content: content });
      if (res.error) { toast('Reset failed: ' + res.error.message, 'error'); }
      else { showSection(activeSection); toast('Reset complete ✓', 'success'); }
    });

    /* Logout */
    var logBtn = $id('logout-btn');
    if (logBtn) logBtn.addEventListener('click', async function () {
      await sb.auth.signOut();
      $id('admin-view').hidden = true;
      $id('login-view').hidden = false;
      toast('Signed out.');
    });

    /* Add Project */
    var addPr = $id('add-project-btn');
    if (addPr) addPr.addEventListener('click', function () {
      var id = slugify('project-' + Date.now());
      content.projects.unshift({ id, title:'New Project', category:'Creative', highlight:'Short hook', description:'Describe the project.', tools:['Tool'], status:'Draft', featured:false, url:'', thumbnail:'' });
      selectedProjectId = id;
      renderProjectsSection();
      toast('Project added.', 'success');
    });

    /* Add Video */
    var addVid = $id('add-video-btn');
    if (addVid) addVid.addEventListener('click', function () {
      content.videos.push({ id: uid(), title:'New Video', type:'YouTube', url:'', fileUrl:'', thumbnail:'', description:'' });
      selectedVideoIdx = content.videos.length - 1;
      renderVideosSection();
      toast('Video slot added.', 'success');
    });
    var delVid = $id('delete-video-btn');
    if (delVid) delVid.addEventListener('click', function () {
      if (content.videos.length <= 1) { toast('Cannot delete last video.', 'error'); return; }
      content.videos.splice(selectedVideoIdx, 1);
      selectedVideoIdx = Math.max(0, selectedVideoIdx - 1);
      renderVideosSection();
      toast('Video deleted.', 'success');
    });

    /* Add Model */
    var addMod = $id('add-model-btn');
    if (addMod) addMod.addEventListener('click', function () {
      content.models.push({ id: uid(), title:'New Model', format:'GLB', url:'', fileUrl:'', thumbnail:'', description:'' });
      selectedModelIdx = content.models.length - 1;
      renderModelsSection();
      toast('Model slot added.', 'success');
    });
    var delMod = $id('delete-model-btn');
    if (delMod) delMod.addEventListener('click', function () {
      if (content.models.length <= 1) { toast('Cannot delete last model.', 'error'); return; }
      content.models.splice(selectedModelIdx, 1);
      selectedModelIdx = Math.max(0, selectedModelIdx - 1);
      renderModelsSection();
      toast('Model deleted.', 'success');
    });

    /* Add Track */
    var addTr = $id('add-track-btn');
    if (addTr) addTr.addEventListener('click', function () {
      content.tracks.push({ id: uid(), title:'New Track', url:'', fileUrl:'', description:'' });
      selectedTrackIdx = content.tracks.length - 1;
      renderMusicSection();
      toast('Track added.', 'success');
    });
    var delTr = $id('delete-track-btn');
    if (delTr) delTr.addEventListener('click', function () {
      if (content.tracks.length <= 1) { toast('Cannot delete last track.', 'error'); return; }
      content.tracks.splice(selectedTrackIdx, 1);
      selectedTrackIdx = Math.max(0, selectedTrackIdx - 1);
      renderMusicSection();
      toast('Track deleted.', 'success');
    });

    /* Add Lyric */
    var addLyr = $id('add-lyric-btn');
    if (addLyr) addLyr.addEventListener('click', function () {
      var id = 'lyric-' + Date.now();
      content.lyrics.unshift({ id, title:'New Lyric', mood:'Draft', text:'Write here…' });
      selectedLyricId = id;
      renderLyricsSection();
      toast('Lyric added.', 'success');
    });

    /* Add Stat */
    var addSt = $id('add-stat-btn');
    if (addSt) addSt.addEventListener('click', function () {
      content.stats.push({ label: 'Label', value: '0' });
      renderStatsAdmin();
    });

    /* Add Timeline */
    var addTl = $id('add-timeline-btn');
    if (addTl) addTl.addEventListener('click', function () {
      content.timeline.push({ id: uid(), title: 'New Entry', meta: 'Organisation · Dates', text: 'Description.' });
      renderTimelineAdmin();
    });

    /* Login form */
    var loginForm = $id('login-form');
    if (loginForm) loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pass = $id('admin-passcode').value;
      toast('Authenticating…');
      var res = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pass });
      if (res.error) {
        toast('Access Denied: ' + res.error.message, 'error');
      } else {
        showAdminPanel();
        toast('Welcome back ✓', 'success');
      }
    });
  }

  function showAdminPanel() {
    var login = $id('login-view');
    var admin = $id('admin-view');
    if (login) login.hidden = true;
    if (admin) admin.hidden = false;
    selectedProjectId = (content.projects[0]||{}).id || null;
    selectedLyricId   = (content.lyrics[0]  ||{}).id || null;
    showSection('profile');
  }

  /* ── BOOT ─────────────────────────────────────────── */
  await loadContent();
  bindActions();

  /* Check existing session */
  var session = await sb.auth.getSession();
  if (session.data && session.data.session) {
    showAdminPanel();
  }

})();