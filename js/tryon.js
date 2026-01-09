// Lightweight "virtual try-on": opens the camera and overlays the selected product image.
// This is NOT true AR (no hand/face tracking). It is a practical demo: move/scale the overlay.

(function () {
  const qs = (s, r = document) => r.querySelector(s);

  function ensureModal() {
    if (qs('#tryonModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="modal fade" id="tryonModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" data-i18n="try_on">جرّبي بالكاميرا</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex gap-3 flex-wrap">
              <div style="position:relative; flex:1; min-width:280px;">
                <video id="tryonVideo" autoplay playsinline style="width:100%; border-radius:12px; background:#000;"></video>
                <canvas id="tryonCanvas" style="position:absolute; inset:0; width:100%; height:100%;"></canvas>
              </div>
              <div style="width:260px;">
                <div class="alert alert-info" style="font-size:14px;">
                  اسحبي الصورة فوق الفيديو لتوضعيها، واستخدمي العجلة/اللمس للتكبير.
                </div>
                <div class="d-grid gap-2">
                  <button class="btn btn-outline-secondary" id="tryonFlip">تبديل الكاميرا</button>
                  <button class="btn btn-outline-secondary" id="tryonReset">إعادة ضبط</button>
                  <button class="btn btn-danger" id="tryonStop">إيقاف</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  let stream = null;
  let facingMode = 'user';
  const overlayImg = new Image();
  const state = { x: 0.5, y: 0.55, scale: 0.45, dragging: false, lastX: 0, lastY: 0 };

  async function startCamera() {
    const video = qs('#tryonVideo');
    if (!video) return;
    if (stream) stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    video.srcObject = stream;
    await video.play();
    requestAnimationFrame(render);
  }

  function stopCamera() {
    const video = qs('#tryonVideo');
    if (video) video.srcObject = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function render() {
    const video = qs('#tryonVideo');
    const canvas = qs('#tryonCanvas');
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (overlayImg.complete && overlayImg.naturalWidth) {
      const imgW = overlayImg.naturalWidth;
      const imgH = overlayImg.naturalHeight;
      const s = Math.min(w, h) * state.scale;
      const drawW = (imgW / Math.max(imgW, imgH)) * s;
      const drawH = (imgH / Math.max(imgW, imgH)) * s;
      const x = state.x * w - drawW / 2;
      const y = state.y * h - drawH / 2;
      ctx.drawImage(overlayImg, x, y, drawW, drawH);
    }
    if (stream) requestAnimationFrame(render);
  }

  function wireCanvas() {
    const canvas = qs('#tryonCanvas');
    if (!canvas) return;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return { x, y };
    };

    canvas.addEventListener('pointerdown', (e) => {
      state.dragging = true;
      const p = getPos(e);
      state.lastX = p.x;
      state.lastY = p.y;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
      const p = getPos(e);
      const dx = p.x - state.lastX;
      const dy = p.y - state.lastY;
      state.x = Math.max(0.05, Math.min(0.95, state.x + dx));
      state.y = Math.max(0.05, Math.min(0.95, state.y + dy));
      state.lastX = p.x;
      state.lastY = p.y;
    });
    canvas.addEventListener('pointerup', () => (state.dragging = false));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      state.scale = Math.max(0.15, Math.min(0.9, state.scale - delta * 0.03));
    }, { passive: false });
  }

  function bindUI() {
    const flip = qs('#tryonFlip');
    const reset = qs('#tryonReset');
    const stop = qs('#tryonStop');
    if (flip) flip.onclick = async () => { facingMode = facingMode === 'user' ? 'environment' : 'user'; await startCamera(); };
    if (reset) reset.onclick = () => { state.x = 0.5; state.y = 0.55; state.scale = 0.45; };
    if (stop) stop.onclick = () => stopCamera();
    const modal = qs('#tryonModal');
    if (modal) {
      modal.addEventListener('hidden.bs.modal', () => stopCamera());
    }
  }

  async function openTryOn(imgSrc) {
    ensureModal();
    overlayImg.src = imgSrc;
    try {
      const m = new bootstrap.Modal(qs('#tryonModal'));
      m.show();
      wireCanvas();
      bindUI();
      await startCamera();
    } catch (e) {
      alert('لم نستطع تشغيل الكاميرا. تأكدي من إعطاء صلاحية الكاميرا للمتصفح.');
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#tryOnBtn');
    if (!btn) return;
    const img = qs('#modalImg');
    const src = img?.getAttribute('src') || '';
    if (!src) return;
    openTryOn(src);
  });
})();
