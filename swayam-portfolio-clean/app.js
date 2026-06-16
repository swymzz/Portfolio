/* ============================================================
   APP.JS — Portfolio Front-End: Three.js, 3D Carousel,
            Card Tilt, model-viewer, Audio Player, Animations
   ============================================================ */

(async function () {

  /* ── Supabase ─────────────────────────────────────── */
  var SUPABASE_URL = 'https://zctfnbiexqzbnjrhgkjq.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjdGZuYmlleHF6Ym5qcmhna2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDA0MTUsImV4cCI6MjA5NzExNjQxNX0.N0CLFdvGQ7n0_rqavqZDEmxdC2n7OfJ2EfxQRGhWbMY';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var fallback = window.PORTFOLIO_DEFAULT_CONTENT;
  var data = clone(fallback);

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  async function loadContent() {
    try {
      var res = await sb.from('portfolio_data').select('content').eq('id', 1).single();
      if (res.data && res.data.content) {
        data = Object.assign(clone(fallback), res.data.content);
      }
    } catch (e) { /* use fallback */ }
  }

  await loadContent();

  /* ── Utils ────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }
  function setText(id, val) { var el = $id(id); if (el) el.textContent = val || ''; }
  function esc(v)  {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function parseYT(url) {
    if (!url) return '';
    var m = String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }
  function ytThumb(id) { return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : ''; }

  /* Parse Instagram post/reel URL → postId (or '' if not IG) */
  function parseIG(url) {
    if (!url) return '';
    var m = String(url).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  }
  function isIGUrl(url) { return /instagram\.com/.test(String(url || '')); }
  function isYTUrl(url) { return /youtube\.com|youtu\.be/.test(String(url || '')); }

  /* ── THREE.JS HERO BACKGROUND ─────────────────────── */
  async function initThree() {
    if (typeof THREE === 'undefined') return;
    var canvas = $id('hero-canvas');
    if (!canvas) return;

    var renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x020208, 1);

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    var nebula = null;

    // ── Instant particle starfield (shows while GLB loads) ──────────────────
    (function createStars() {
      // Create a circular sprite texture so stars look round, not square
      var spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = 32; spriteCanvas.height = 32;
      var ctx = spriteCanvas.getContext('2d');
      var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0,   'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      var spriteTex = new THREE.CanvasTexture(spriteCanvas);

      var geometry = new THREE.BufferGeometry();
      var count = 2500;
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 400; // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * 200; // y
        // z: always behind camera (which is at z=0.1), minimum 15 units back
        positions[i * 3 + 2] = -(Math.random() * 180 + 15);
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var material = new THREE.PointsMaterial({
        map: spriteTex,
        color: 0xffffff, size: 1.2,
        transparent: true, opacity: 0.8,
        sizeAttenuation: true,
        depthWrite: false
      });
      scene.add(new THREE.Points(geometry, material));
    })();
    // ────────────────────────────────────────────────────────────────────────

    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      loader.load(
        'https://zctfnbiexqzbnjrhgkjq.supabase.co/storage/v1/object/public/portfolio-media/backgrounds/Nebula_HDRi_2.glb',
        function(gltf) {
          // Success
          nebula = gltf.scene;
          nebula.scale.set(100, 100, 100);
          scene.add(nebula);
          document.body.classList.add('loaded');
        },
        function(xhr) {
          // Progress - show website after 3s even if still loading
          if (!document.body.classList.contains('loaded')) {
            clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(function() {
              document.body.classList.add('loaded');
            }, 3000);
          }
        },
        function(err) {
          // Error fallback
          console.warn('Background load failed, showing site anyway', err);
          document.body.classList.add('loaded');
        }
      );
    } catch(err) {
      console.error('Three.js init error', err);
      document.body.classList.add('loaded');
    }

    // Safety fallback — show website within 2s no matter what
    var fallbackTimer = setTimeout(function() {
      document.body.classList.add('loaded');
    }, 2000);

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targetX = 0, targetY = 0, camX = 0, camY = 0;

    // Comet cursor
    var cursor = $id('comet-cursor');
    var tail   = $id('comet-tail');
    var cX = window.innerWidth / 2, cY = window.innerHeight / 2;
    var mX = cX, mY = cY, pX = cX, pY = cY;

    function updateParallax(x, y) {
      targetX = (x / window.innerWidth  - 0.5) * 1.5;
      targetY = (y / window.innerHeight - 0.5) * 1.0;
    }

    document.addEventListener('mousemove', function(e) {
      updateParallax(e.clientX, e.clientY);
      mX = e.clientX; mY = e.clientY;
    });
    document.addEventListener('touchmove', function(e) {
      if (e.touches.length > 0) updateParallax(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('mousedown', function(e) {
      var boom = document.createElement('div');
      boom.className = 'comet-boom';
      boom.style.left = e.clientX + 'px';
      boom.style.top  = e.clientY + 'px';
      document.body.appendChild(boom);
      setTimeout(function() { boom.remove(); }, 500);
    });

    document.addEventListener('mouseover', function(e) {
      if (cursor) {
        cursor.classList.toggle('hovering',
          !!e.target.closest('a,button,.brand,input,textarea,.project-card,.model-item'));
      }
    });

    function animate() {
      if (!reducedMotion) requestAnimationFrame(animate);

      camX += (targetX - camX) * 0.05;
      camY += (targetY - camY) * 0.05;
      camera.rotation.y = -camX * 0.3;
      camera.rotation.x = -camY * 0.3;

      if (nebula) {
        nebula.rotation.y += 0.0003;
        nebula.rotation.x += 0.0001;
      }

      // Comet cursor
      cX += (mX - cX) * 0.8;
      cY += (mY - cY) * 0.8;
      if (cursor) {
        cursor.style.transform = `translate(${cX}px, ${cY}px)`;
        var dx = cX - pX, dy = cY - pY;
        var speed = Math.sqrt(dx*dx + dy*dy);
        if (speed > 1) {
          var angle = Math.atan2(dy, dx) * 180 / Math.PI;
          tail.style.transform = `translate(0,-50%) rotate(${angle+180}deg)`;
          tail.style.width   = Math.min(speed * 1.5, 100) + 'px';
          tail.style.opacity = Math.min(speed * 0.1, 1);
        } else {
          tail.style.opacity = Math.max(parseFloat(tail.style.opacity || 0) - 0.1, 0);
        }
        pX = cX; pY = cY;
      }

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ── RENDER PROFILE ───────────────────────────────── */
  function renderProfile() {
    var p = data.profile || {};
    var h = data.hero    || {};

    /* Brand initials */
    setText('brand-text', p.brandInitials || 'SK');

    /* Hero panel Mode / Live */
    setText('panel-label', h.panelLabel || 'Mode');
    setText('panel-value', h.panelValue || 'Live');

    setText('hero-eyebrow', h.eyebrow   || fallback.hero.eyebrow);
    setText('hero-name',    p.name      || '');
    setText('hero-title',   p.title     || '');
    setText('hero-bio',     p.intro     || '');
    setText('about-text',   p.about     || '');
    setText('contact-line', p.contactLine || '');

    if ($id('hero-cta1')) { $id('hero-cta1').textContent = h.cta1Label || 'Explore Work'; $id('hero-cta1').href = h.cta1Href || '#work'; }
    if ($id('hero-cta2')) { $id('hero-cta2').textContent = h.cta2Label || 'View 3D Lab';  $id('hero-cta2').href = h.cta2Href || '#lab';  }

    /* Tags */
    var tagsEl = $id('hero-tags');
    if (tagsEl) tagsEl.innerHTML = (data.tags || []).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');

    /* Stats */
    var sgEl = $id('stats-grid');
    if (sgEl) sgEl.innerHTML = (data.stats || []).map(function (s) {
      return '<div class="stat-card"><strong>' + esc(s.value) + '</strong><span>' + esc(s.label) + '</span></div>';
    }).join('');

    /* Skills */
    var skEl = $id('skill-cloud');
    if (skEl) skEl.innerHTML = (data.skills || []).map(function (s) {
      return '<span class="skill-pill">' + esc(s) + '</span>';
    }).join('');

    /* Contact actions */
    var caEl = $id('contact-actions');
    if (caEl) caEl.innerHTML = [
      p.email      ? '<a class="btn btn-primary" href="mailto:' + esc(p.email) + '">Email Me</a>'       : '',
      p.linkedin   ? '<a class="btn btn-ghost" target="_blank" rel="noreferrer" href="' + esc(p.linkedin) + '">LinkedIn</a>' : '',
      p.github     ? '<a class="btn btn-ghost" target="_blank" rel="noreferrer" href="' + esc(p.github) + '">GitHub</a>'    : '',
      p.resumeUrl  ? '<a class="btn btn-ghost" target="_blank" rel="noreferrer" href="' + esc(p.resumeUrl) + '">Resume</a>' : ''
    ].join('');

    /* Marquee — triple for seamless scroll at -33.333% */
    var mEl = $id('marquee-track');
    if (mEl) {
      var items = (data.marqueeItems || fallback.marqueeItems);
      mEl.innerHTML = [...items, ...items, ...items].map(function (item) {
        return '<span class="marquee-item">' + esc(item) + '</span>';
      }).join('');
    }
  }

  /* ── PROJECTS ─────────────────────────────────────── */
  var activeFilter = 'All';

  function getCategories() {
    var cats = (data.projects || []).map(function (p) { return p.category || 'Other'; });
    return ['All'].concat(cats.filter(function (c, i) { return cats.indexOf(c) === i; }));
  }

  function filteredProjects() {
    if (activeFilter === 'All') return data.projects || [];
    return (data.projects || []).filter(function (p) { return p.category === activeFilter; });
  }

  function renderProjectFilters() {
    var el = $id('project-filters');
    if (!el) return;
    el.innerHTML = getCategories().map(function (c) {
      return '<button class="filter-chip' + (c === activeFilter ? ' active' : '') + '" data-filter="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    el.querySelectorAll('.filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.dataset.filter;
        renderProjectFilters();
        renderProjects();
      });
    });
  }

  function renderProjects() {
    var grid = $id('project-grid');
    if (!grid) return;
    var projects = filteredProjects();

    grid.innerHTML = projects.map(function (p, idx) {
      var tools = (p.tools || []).slice(0, 5).map(function (t) {
        return '<span class="tool-chip">' + esc(t) + '</span>';
      }).join('');
      var thumb = p.thumbnail
        ? '<img class="slide-thumb" src="' + esc(p.thumbnail) + '" alt="" loading="lazy" />'
        : '';
      return [
        '<div class="card-wrap" data-animate data-delay="' + ((idx % 3) + 1) + '">',
        '<article class="project-card" data-pid="' + esc(p.id) + '">',
        thumb,
        '<div class="card-top">',
        '<span class="card-cat">'    + esc(p.category || 'Work') + '</span>',
        '<span class="card-status">' + esc(p.status   || '')    + '</span>',
        '</div>',
        '<h3>' + esc(p.title) + '</h3>',
        '<p class="highlight">' + esc(p.highlight) + '</p>',
        '<div class="tool-row">' + tools + '</div>',
        p.url ? '<span class="card-link">Open case &#8594;</span>' : '',
        '</article>',
        '</div>'
      ].join('');
    }).join('');

    /* 3D tilt on each card — desktop only, disabled on touch */
    var isTouch = window.matchMedia('(pointer: coarse)').matches;
    grid.querySelectorAll('.project-card').forEach(function (card) {
      var wrap = card.parentElement;
      if (!isTouch) {
        wrap.addEventListener('mousemove', function (e) {
          var r  = card.getBoundingClientRect();
          var x  = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
          var y  = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
          card.style.transform = 'rotateX(' + (-y * 9) + 'deg) rotateY(' + (x * 9) + 'deg) translateZ(8px)';
          card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
          card.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
        });
        wrap.addEventListener('mouseleave', function () {
          card.style.transform = '';
        });
      }
      
      // Find the associated project data to check for URL
      var p = (data.projects || []).find(function(item) { return item.id === card.dataset.pid; });
      if (p && p.url) {
        card.addEventListener('click', function () { openProject(card.dataset.pid); });
        card.addEventListener('touchend', function (e) {
          e.preventDefault();
          openProject(card.dataset.pid);
        });
      } else {
        card.style.cursor = 'default';
        // Ensure no pointer events class can be added if needed, but removing the listener is enough
        // We'll also tell the CSS not to show the hover effects by removing the pointer cursor
      }
    });

    /* Re-observe new cards for scroll animations */
    observeAnimated();
  }

  function openProject(id) {
    var p = (data.projects || []).find(function (item) { return item.id === id; });
    if (!p) return;
    var tools = (p.tools || []).map(function (t) { return '<span class="tool-chip">' + esc(t) + '</span>'; }).join('');
    $id('dialog-content').innerHTML = [
      '<p class="eyebrow dialog-eyebrow">' + esc(p.category) + '</p>',
      '<h2 class="dialog-title">' + esc(p.title) + '</h2>',
      '<p class="dialog-lead">' + esc(p.description) + '</p>',
      '<div class="tool-row" style="margin:20px 0 24px">' + tools + '</div>',
      p.url ? '<a class="btn btn-primary" target="_blank" rel="noreferrer" href="' + esc(p.url) + '">Open Project &#8594;</a>' : ''
    ].join('');
    $id('project-dialog').showModal();
  }

  /* ── 3D VIDEO CAROUSEL ────────────────────────────── */
  var carouselIndex = 0;
  var carouselVideos = [];

  function renderCarousel() {
    carouselVideos = data.videos || [];
    var track = $id('carousel-track');
    var dots  = $id('carousel-dots');
    if (!track) return;

    if (!carouselVideos.length) {
      track.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:60px 20px">No videos yet — add them in the Admin panel.</div>';
      return;
    }

    track.innerHTML = carouselVideos.map(function (v, i) {
      var ytId  = parseYT(v.url);
      var igId  = parseIG(v.url);
      var thumb = v.thumbnail || (ytId ? ytThumb(ytId) : '');
      var mediaHtml = '';

      if (thumb) {
        mediaHtml = '<img class="slide-thumb" src="' + esc(thumb) + '" alt="' + esc(v.title) + '" loading="lazy" />';
      } else if (igId || isIGUrl(v.url)) {
        mediaHtml = '<img class="slide-thumb ig-thumb" data-ig="' + esc(v.url) + '" alt="' + esc(v.title) + '" loading="lazy" />';
      } else {
        mediaHtml = '<div class="slide-placeholder"><span class="slide-placeholder-icon">&#127909;</span><p>No preview</p></div>';
      }

      return [
        '<div class="carousel-slide" data-idx="' + i + '">',
        '<div class="carousel-slide-inner">',
        '<div class="slide-media">',
        mediaHtml,
        '<div class="slide-play-overlay">',
        '<div class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>',
        '</div>',
        '</div>',
        '<div class="slide-info">',
        '<span class="slide-badge">' + esc(v.type || 'Video') + '</span>',
        '<h3>' + esc(v.title) + '</h3>',
        v.description ? '<p>' + esc(v.description) + '</p>' : '',
        '</div>',
        '</div>',
        '</div>'
      ].join('');
    }).join('');

    /* Fetch IG thumbnails asynchronously */
    track.querySelectorAll('.ig-thumb').forEach(function(img) {
      fetch('https://api.microlink.io/?url=' + encodeURIComponent(img.dataset.ig))
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.data && d.data.image && d.data.image.url) {
            img.src = d.data.image.url;
            img.classList.remove('ig-thumb');
          } else {
            img.outerHTML = '<div class="slide-placeholder"><span class="slide-placeholder-icon">&#127909;</span><p>No preview</p></div>';
          }
        }).catch(function(){});
    });

    /* Dots */
    if (dots) dots.innerHTML = carouselVideos.map(function (_, i) {
      return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '" aria-label="Video ' + (i + 1) + '"></button>';
    }).join('');

    positionCarousel();

    /* Slide click → open video or promote */
    track.querySelectorAll('.carousel-slide').forEach(function (slide) {
      slide.addEventListener('click', function () {
        var idx = parseInt(slide.dataset.idx);
        if (idx === carouselIndex) {
          openVideoModal(carouselVideos[idx]);
        } else {
          carouselIndex = idx;
          positionCarousel();
        }
      });
    });

    /* Dot clicks */
    if (dots) dots.querySelectorAll('.carousel-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        carouselIndex = parseInt(dot.dataset.dot);
        positionCarousel();
      });
    });
  }

  function positionCarousel() {
    var track = $id('carousel-track');
    if (!track) return;
    var slides = track.querySelectorAll('.carousel-slide');
    var n = slides.length;
    if (!n) return;

    slides.forEach(function (slide, i) {
      var offset = i - carouselIndex;
      /* Wrap circular */
      if (offset > n / 2)  offset -= n;
      if (offset < -n / 2) offset += n;
      var abs = Math.abs(offset);

      var transform, opacity, zIndex, filter;
      /* Width in px (responsive) */
      var w = Math.min(520, Math.max(260, window.innerWidth * 0.38));
      var half = w / 2;

      if (abs > 2) {
        transform = 'translateX(-50%) scale(0.5)';
        opacity   = 0;
        zIndex    = 0;
        filter    = 'brightness(0.4)';
      } else if (offset === 0) {
        transform = 'translateX(-50%) translateZ(220px) scale(1)';
        opacity   = 1;
        zIndex    = 10;
        filter    = 'brightness(1)';
        slide.classList.add('active');
      } else if (abs === 1) {
        var dir = offset > 0 ? 1 : -1;
        transform = 'translateX(calc(-50% + ' + (dir * (w * 0.72)) + 'px)) rotateY(' + (-dir * 38) + 'deg) translateZ(-30px) scale(0.84)';
        opacity   = 0.68;
        zIndex    = 5;
        filter    = 'brightness(0.65)';
        slide.classList.remove('active');
      } else {
        var dir2 = offset > 0 ? 1 : -1;
        transform = 'translateX(calc(-50% + ' + (dir2 * (w * 1.35)) + 'px)) rotateY(' + (-dir2 * 58) + 'deg) translateZ(-180px) scale(0.62)';
        opacity   = 0.28;
        zIndex    = 1;
        filter    = 'brightness(0.4)';
        slide.classList.remove('active');
      }

      slide.style.transform = transform;
      slide.style.opacity   = opacity;
      slide.style.zIndex    = zIndex;
      slide.style.filter    = filter;
    });

    /* Sync dots */
    var dotsWrap = $id('carousel-dots');
    if (dotsWrap) dotsWrap.querySelectorAll('.carousel-dot').forEach(function (dot) {
      dot.classList.toggle('active', parseInt(dot.dataset.dot) === carouselIndex);
    });
  }

  function prevSlide() {
    var n = carouselVideos.length;
    if (!n) return;
    carouselIndex = (carouselIndex - 1 + n) % n;
    positionCarousel();
  }

  function nextSlide() {
    var n = carouselVideos.length;
    if (!n) return;
    carouselIndex = (carouselIndex + 1) % n;
    positionCarousel();
  }

  /* ── VIDEO MODAL ──────────────────────────────────── */
  var vmType     = '';    /* 'youtube' | 'file' */
  var vmMuted    = false;
  var vmIframe   = null;
  var vmVideoEl  = null;

  function openVideoModal(video) {
    if (!video) return;
    var modal  = $id('video-modal');
    var player = $id('vm-player');
    var titleEl= $id('vm-title');
    if (!modal || !player) return;

    if (titleEl) titleEl.textContent = video.title || 'Video';
    player.innerHTML = '';
    vmIframe = null;
    vmVideoEl = null;
    vmMuted  = false;
    updateMuteBtn();

    var ytId   = parseYT(video.url);
    var igId   = parseIG(video.url);
    var fileUrl = video.fileUrl || '';

    // Reset player layout for dynamic aspect ratios
    player.style.aspectRatio = '16/9';
    player.style.width = '100%';

    if (ytId) {
      vmType = 'youtube';
      var iframe = document.createElement('iframe');
      iframe.id  = 'yt-iframe';
      // Added vq=hd1080 to force 1080p resolution
      iframe.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1&enablejsapi=1&rel=0&modestbranding=1&vq=hd1080';
      iframe.allow = 'autoplay; encrypted-media; fullscreen';
      iframe.setAttribute('allowfullscreen', '');
      iframe.title = esc(video.title || 'Video');
      player.appendChild(iframe);
      vmIframe = iframe;

    } else if (igId || isIGUrl(video.url)) {
      // Instagram embed — without "captioned/" it hides the caption for a cleaner look
      vmType = 'instagram';
      var igWrap = document.createElement('div');
      igWrap.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;';

      var igFrame = document.createElement('iframe');
      igFrame.src = 'https://www.instagram.com/p/' + (igId || '') + '/embed/?autoplay=1';
      igFrame.allow = 'autoplay; encrypted-media; fullscreen';
      igFrame.setAttribute('allowfullscreen', '');
      // Let it fill the dynamic player aspect ratio completely
      igFrame.style.cssText = 'width:100%;height:100%;border:0;background:#000;border-radius:8px;';
      igFrame.title = esc(video.title || 'Instagram Video');
      igWrap.appendChild(igFrame);
      player.appendChild(igWrap);
      vmIframe = igFrame;

      // Fetch aspect ratio to size the player perfectly (1:1, 16:9, etc.)
      fetch('https://api.microlink.io/?url=' + encodeURIComponent(video.url))
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d.data && d.data.image && d.data.image.width && d.data.image.height) {
            var ar = d.data.image.width / d.data.image.height;
            player.style.aspectRatio = String(ar);
          }
        }).catch(function(){});

    } else if (fileUrl || video.url) {
      vmType = 'file';
      var vid = document.createElement('video');
      vid.src      = fileUrl || video.url;
      vid.controls = true;
      vid.autoplay = true;
      vid.style.cssText = 'width:100%;height:100%;background:#000;';
      player.appendChild(vid);
      vmVideoEl = vid;

    } else {
      player.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:0.9rem">No video source set.</div>';
    }

    modal.hidden = false;
  }

  function closeVideoModal() {
    var modal  = $id('video-modal');
    var player = $id('vm-player');
    if (modal)  modal.hidden = true;
    if (player) player.innerHTML = '';
    vmIframe  = null;
    vmVideoEl = null;
  }

  function updateMuteBtn() {
    var btn = $id('vm-mute');
    if (!btn) return;
    btn.innerHTML = vmMuted ? '&#128263;' : '&#128266;';
    btn.classList.toggle('muted', vmMuted);
    btn.setAttribute('title', vmMuted ? 'Unmute' : 'Mute');
  }

  function toggleMuteVideo() {
    vmMuted = !vmMuted;
    if (vmType === 'youtube' && vmIframe) {
      var cmd = JSON.stringify({ event: 'command', func: vmMuted ? 'mute' : 'unMute', args: [] });
      try { vmIframe.contentWindow.postMessage(cmd, '*'); } catch (e) {}
    } else if (vmType === 'file' && vmVideoEl) {
      vmVideoEl.muted = vmMuted;
    }
    updateMuteBtn();
  }

  /* ── 3D MODELS CAROUSEL ────────────────────────────── */
  var modelIndex = 0;
  var modelItems = [];

  function renderModels() {
    modelItems = data.models || [];
    var track = $id('model-track');
    var dots  = $id('model-dots');
    if (!track) return;

    if (!modelItems.length) {
      track.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:60px 20px">No 3D models yet — add them in the Admin panel.</div>';
      return;
    }

    track.innerHTML = modelItems.map(function (m, i) {
      var fileUrl = m.fileUrl || '';
      var viewerHtml = fileUrl
        ? '<model-viewer src="' + esc(fileUrl) + '" camera-controls auto-rotate shadow-intensity="0.5" environment-image="neutral" exposure="0.8" ar ar-modes="scene-viewer webxr" loading="lazy" alt="' + esc(m.title) + '"></model-viewer>'
        : '<div class="slide-placeholder"><span class="slide-placeholder-icon">&#127922;</span><p>No GLB file</p></div>';

      return [
        '<div class="carousel-slide model-slide" data-idx="' + i + '">',
        '<div class="carousel-slide-inner" style="border-radius:var(--r-lg);">',
        '<div class="slide-media" style="aspect-ratio:4/3;background:linear-gradient(135deg, rgba(167,139,250,0.06), rgba(34,211,238,0.06));">',
        viewerHtml,
        '</div>',
        '<div class="slide-info">',
        '<span class="slide-badge" style="background:var(--purple-glow);color:var(--purple);border-color:var(--border-purple);">' + esc(m.format || '3D') + '</span>',
        '<h3>' + esc(m.title) + '</h3>',
        m.description ? '<p>' + esc(m.description) + '</p>' : '',
        '</div>',
        '</div>',
        '</div>'
      ].join('');
    }).join('');

    /* Dots */
    if (dots) dots.innerHTML = modelItems.map(function (_, i) {
      return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '" aria-label="Model ' + (i + 1) + '"></button>';
    }).join('');

    positionModelCarousel();

    /* Buttons */
    var pBtn = $id('model-prev'), nBtn = $id('model-next');
    if (pBtn && nBtn) {
      var np = pBtn.cloneNode(true); pBtn.parentNode.replaceChild(np, pBtn);
      var nn = nBtn.cloneNode(true); nBtn.parentNode.replaceChild(nn, nBtn);
      np.addEventListener('click', function(){
        var n = modelItems.length; if(!n) return;
        modelIndex = (modelIndex - 1 + n) % n; positionModelCarousel();
      });
      nn.addEventListener('click', function(){
        var n = modelItems.length; if(!n) return;
        modelIndex = (modelIndex + 1) % n; positionModelCarousel();
      });
    }

    /* Dot clicks */
    if (dots) dots.querySelectorAll('.carousel-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        modelIndex = parseInt(dot.dataset.dot);
        positionModelCarousel();
      });
    });
  }

  function positionModelCarousel() {
    var track = $id('model-track');
    if (!track) return;
    var slides = track.querySelectorAll('.carousel-slide');
    var n = slides.length;
    if (!n) return;

    slides.forEach(function (slide, i) {
      var offset = i - modelIndex;
      if (offset > n / 2)  offset -= n;
      if (offset < -n / 2) offset += n;
      var abs = Math.abs(offset);

      var transform, opacity, zIndex, filter;
      var w = Math.min(520, Math.max(260, window.innerWidth * 0.38));

      if (abs > 2) {
        transform = 'translateX(-50%) scale(0.5)';
        opacity   = 0;
        zIndex    = 0;
        filter    = 'brightness(0.4)';
      } else if (offset === 0) {
        transform = 'translateX(-50%) translateZ(220px) scale(1)';
        opacity   = 1;
        zIndex    = 10;
        filter    = 'brightness(1)';
        slide.classList.add('active');
        slide.style.pointerEvents = 'auto'; // enable model-viewer interaction
      } else if (abs === 1) {
        var dir = offset > 0 ? 1 : -1;
        transform = 'translateX(calc(-50% + ' + (dir * (w * 0.72)) + 'px)) rotateY(' + (-dir * 38) + 'deg) translateZ(-30px) scale(0.84)';
        opacity   = 0.68;
        zIndex    = 5;
        filter    = 'brightness(0.65)';
        slide.classList.remove('active');
        slide.style.pointerEvents = 'none'; // disable model interaction in bg
      } else {
        var dir2 = offset > 0 ? 1 : -1;
        transform = 'translateX(calc(-50% + ' + (dir2 * (w * 1.35)) + 'px)) rotateY(' + (-dir2 * 58) + 'deg) translateZ(-180px) scale(0.62)';
        opacity   = 0.28;
        zIndex    = 1;
        filter    = 'brightness(0.4)';
        slide.classList.remove('active');
        slide.style.pointerEvents = 'none';
      }

      slide.style.transform = transform;
      slide.style.opacity   = opacity;
      slide.style.zIndex    = zIndex;
      slide.style.filter    = filter;
    });

    var dots = $id('model-dots');
    if (dots) dots.querySelectorAll('.carousel-dot').forEach(function (dot) {
      dot.classList.toggle('active', parseInt(dot.dataset.dot) === modelIndex);
    });
  }

  /* ── AUDIO TRACKS ─────────────────────────────────── */
  function renderTracks() {
    var el = $id('tracks-list');
    if (!el) return;
    var tracks = data.tracks || [];

    if (!tracks.length || (tracks.length === 1 && !tracks[0].url && !tracks[0].fileUrl)) {
      el.innerHTML = '<div class="audio-slot-empty">&#127925; No audio tracks yet — add them in the Admin panel.</div>';
      return;
    }

    el.innerHTML = tracks.map(function (t, i) {
      var src   = t.fileUrl || t.url || '';
      var ytId  = parseYT(src);
      var igId  = parseIG(src);
      var isLink = ytId || igId || isIGUrl(src) || isYTUrl(src);

      var playerHtml;
      if (!src) {
        playerHtml = '<div class="audio-slot-empty">&#128263; No audio source — add a URL or upload in Admin.</div>';
      } else if (ytId) {
        // YouTube — embed as iframe player (forced 1080p)
        playerHtml = [
          '<div class="audio-yt-wrap">',
          '<iframe src="https://www.youtube.com/embed/' + ytId + '?rel=0&modestbranding=1&vq=hd1080"',
          ' allow="autoplay; encrypted-media" allowfullscreen title="' + esc(t.title) + '"></iframe>',
          '</div>'
        ].join('');
      } else if (igId || isIGUrl(src)) {
        // Instagram — embed reel/post
        var pid = igId || '';
        playerHtml = [
          '<div class="audio-ig-wrap">',
          '<iframe src="https://www.instagram.com/p/' + pid + '/embed/captioned/"',
          ' allow="autoplay; encrypted-media" allowfullscreen title="' + esc(t.title) + '"></iframe>',
          '</div>'
        ].join('');
      } else {
        // Raw audio file — native player
        playerHtml = [
          '<div class="audio-player" data-src="' + esc(src) + '">',
          '<button class="ap-play-btn" aria-label="Play">&#9654;</button>',
          '<div class="ap-progress-wrap">',
          '<div class="ap-bar-bg"><div class="ap-bar-fill"></div></div>',
          '<input class="ap-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek" />',
          '</div>',
          '<span class="ap-time">0:00</span>',
          '<button class="ap-mute-btn" aria-label="Mute">&#128266;</button>',
          '</div>'
        ].join('');
      }

      return [
        '<div class="audio-card" data-animate data-delay="' + (i + 1) + '">',
        '<h3>' + esc(t.title) + '</h3>',
        t.description ? '<p class="track-desc">' + esc(t.description) + '</p>' : '',
        playerHtml,
        '</div>'
      ].join('');
    }).join('');

    /* Init native audio players only */
    el.querySelectorAll('.audio-player').forEach(function (wrap) {
      var audio     = new Audio(wrap.dataset.src);
      var playBtn   = wrap.querySelector('.ap-play-btn');
      var seekEl    = wrap.querySelector('.ap-seek');
      var fillEl    = wrap.querySelector('.ap-bar-fill');
      var timeEl    = wrap.querySelector('.ap-time');
      var muteBtn   = wrap.querySelector('.ap-mute-btn');
      var playing   = false;

      function fmtTime(s) {
        if (!s || isNaN(s)) return '0:00';
        var m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2,'0');
      }

      playBtn.addEventListener('click', function () {
        if (playing) { audio.pause(); playBtn.innerHTML = '&#9654;'; }
        else         { audio.play();  playBtn.innerHTML = '&#9646;&#9646;'; }
        playing = !playing;
      });

      audio.addEventListener('ended', function () { playing = false; playBtn.innerHTML = '&#9654;'; });

      audio.addEventListener('timeupdate', function () {
        if (!audio.duration) return;
        var pct = (audio.currentTime / audio.duration) * 100;
        seekEl.value = pct;
        fillEl.style.width = pct + '%';
        timeEl.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration);
      });

      seekEl.addEventListener('input', function () {
        if (audio.duration) audio.currentTime = (seekEl.value / 100) * audio.duration;
      });

      muteBtn.addEventListener('click', function () {
        audio.muted = !audio.muted;
        muteBtn.innerHTML = audio.muted ? '&#128263;' : '&#128266;';
      });
    });

    observeAnimated();
  }

  /* ── LYRICS ───────────────────────────────────────── */
  function renderLyrics() {
    var el = $id('lyrics-list');
    if (!el) return;
    el.innerHTML = (data.lyrics || []).map(function (l) {
      return [
        '<div class="lyric-card">',
        '<p class="lyric-mood">' + esc(l.mood) + '</p>',
        '<h3>' + esc(l.title) + '</h3>',
        '<pre>' + esc(l.text) + '</pre>',
        '</div>'
      ].join('');
    }).join('');
  }

  /* ── TIMELINE ─────────────────────────────────────── */
  function renderTimeline() {
    var el = $id('timeline');
    if (!el) return;
    el.innerHTML = (data.timeline || []).map(function (item) {
      return [
        '<article class="timeline-item">',
        '<div class="timeline-dot"></div>',
        '<h3 class="timeline-title">' + esc(item.title) + '</h3>',
        '<p class="timeline-meta">' + esc(item.meta) + '</p>',
        '<p class="timeline-text">' + esc(item.text) + '</p>',
        '</article>'
      ].join('');
    }).join('');
  }

  /* ── SCROLL ANIMATIONS ────────────────────────────── */
  var observer;
  function observeAnimated() {
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });
    }
    document.querySelectorAll('[data-animate]:not(.visible)').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── DIALOG ───────────────────────────────────────── */
  function initDialog() {
    var dialog = $id('project-dialog');
    if (!dialog) return;
    var closeBtn = dialog.querySelector('.dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* ── CAROUSEL CONTROLS ────────────────────────────── */
  function initCarouselControls() {
    var prev = $id('carousel-prev');
    var next = $id('carousel-next');
    if (prev) prev.addEventListener('click', prevSlide);
    if (next) next.addEventListener('click', nextSlide);

    /* Keyboard navigation */
    document.addEventListener('keydown', function (e) {
      if ($id('video-modal') && !$id('video-modal').hidden) return;
      if (e.key === 'ArrowLeft')  prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    });

    /* Swipe support */
    var startX = 0;
    var stageEl = document.querySelector('.carousel-stage');
    if (stageEl) {
      stageEl.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
      stageEl.addEventListener('touchend',   function (e) {
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) { dx < 0 ? nextSlide() : prevSlide(); }
      });
    }
  }

  /* ── VIDEO MODAL EVENTS ───────────────────────────── */
  function initVideoModal() {
    var closeBtn = $id('vm-close');
    var muteBtn  = $id('vm-mute');
    var backdrop = $id('vm-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);
    if (muteBtn)  muteBtn.addEventListener ('click', toggleMuteVideo);
    if (backdrop) backdrop.addEventListener('click', closeVideoModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeVideoModal();
    });
  }

  /* ── HEADER SCROLL TINT ───────────────────────────── */
  function initHeaderScroll() {
    var header = $id('site-header');
    if (!header) return;
    window.addEventListener('scroll', function () {
      header.style.background = window.scrollY > 60
        ? 'rgba(3,3,10,0.92)'
        : 'rgba(4,4,14,0.75)';
    }, { passive: true });
  }

  /* ── RESIZE CAROUSEL ──────────────────────────────── */
  window.addEventListener('resize', function () {
    if (carouselVideos.length) positionCarousel();
  });

  /* ── RENDER ALL SECTION TEXT (nav, headings, eyebrows, leads) ──── */
  function renderSiteText() {
    var n  = data.nav      || {};
    var s  = data.sections || {};
    var fb = fallback;

    /* Nav labels */
    setText('nav-work',    n.work       || (fb.nav && fb.nav.work)       || 'Work');
    setText('nav-lab',     n.lab        || (fb.nav && fb.nav.lab)        || '3D Lab');
    setText('nav-studio',  n.studio     || (fb.nav && fb.nav.studio)     || 'Studio');
    setText('nav-music',   n.music      || (fb.nav && fb.nav.music)      || 'Music');
    setText('nav-about',   n.about      || (fb.nav && fb.nav.about)      || 'About');
    setText('nav-contact', n.contactBtn || (fb.nav && fb.nav.contactBtn) || 'Contact');

    /* Work section */
    var sw = s.work || {};
    setText('work-eyebrow', sw.eyebrow || 'Selected Work');
    setText('work-heading', sw.heading || 'Engineering precision with creative instinct.');
    setText('work-lead',    sw.lead    || '');

    /* 3D Lab section */
    var sl = s.lab || {};
    setText('lab-eyebrow', sl.eyebrow || '3D Lab');
    setText('lab-heading', sl.heading || 'CAD, mechanisms, and physical ideas.');
    setText('lab-lead',    sl.lead    || '');

    /* Video Studio section */
    var ss = s.studio || {};
    setText('studio-eyebrow', ss.eyebrow || 'Video Studio');
    setText('studio-heading', ss.heading || 'Motion, rhythm, visual storytelling.');
    setText('studio-lead',    ss.lead    || '');

    /* Music section */
    var sm = s.music || {};
    setText('music-eyebrow',      sm.eyebrow     || 'Words & Sound');
    setText('music-heading',      sm.heading     || 'Lyrics, rap drafts, and music drops.');
    setText('music-lead',         sm.lead        || '');
    setText('music-tracks-label', sm.tracksLabel || 'Audio Tracks');
    setText('music-lyrics-label', sm.lyricsLabel || 'Lyrics & Verses');

    /* About section */
    var sa = s.about || {};
    setText('about-eyebrow', sa.eyebrow || 'About');
    setText('about-heading', sa.heading || 'Builder, editor, designer, lyricist.');

    /* Contact section */
    var sc = s.contact || {};
    setText('contact-eyebrow', sc.eyebrow || 'Contact');
    setText('contact-heading', sc.heading || 'Build systems. Shape stories.');
  }

  /* ── BOOT ─────────────────────────────────────────── */
  renderProfile();
  renderSiteText();
  renderProjectFilters();
  renderProjects();
  renderCarousel();
  renderModels();
  renderTracks();
  renderLyrics();
  renderTimeline();
  initDialog();
  initCarouselControls();
  initVideoModal();
  initHeaderScroll();
  initThree();
  observeAnimated();

})();