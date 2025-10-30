/* popup.js — simple toggle for auto preview */

const el = document.getElementById('auto');

chrome.storage.local.get({ autoPreview: true }, (res) => {
  el.checked = Boolean(res.autoPreview);
});

el.addEventListener('change', () => {
  chrome.storage.local.set({ autoPreview: el.checked });
});

