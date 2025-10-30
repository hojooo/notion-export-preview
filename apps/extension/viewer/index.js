// Minimal viewer controller using the browser PDF renderer.

(function () {
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const orig = params.get('orig');
  const filename = decodeURIComponent(params.get('filename') || 'notion-export.pdf');

  const frame = document.getElementById('pdf');
  const title = document.getElementById('title');
  const btnSave = document.getElementById('save');
  const btnOrig = document.getElementById('original');
  const btnPrint = document.getElementById('print');

  if (filename) title.textContent = filename;
  if (src) frame.src = src;

  btnSave.addEventListener('click', () => {
    if (!src) return;
    chrome.downloads.download({ url: src, filename });
  });

  btnOrig.addEventListener('click', () => {
    if (!orig) return;
    chrome.downloads.download({ url: orig });
  });

  btnPrint.addEventListener('click', () => {
    // Attempt to print the embedded PDF. Some browsers may block programmatic print on blob.
    try {
      const w = window.open(src);
      if (w) {
        // Give the viewer a moment to load before printing
        setTimeout(() => { try { w.print(); } catch (_) {} }, 500);
      }
    } catch (_) {}
  });
})();

