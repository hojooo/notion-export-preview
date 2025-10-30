// Notion Export Preview — MV3 Service Worker (no bundler)

const ALLOWED_HOST_PATTERNS = [
  /^https:\/\/(www\.)?notion\.so\//,
  /^https:\/\/.*\.amazonaws\.com\//,
];

function isAllowedUrl(url) {
  return ALLOWED_HOST_PATTERNS.some((re) => re.test(url));
}

function getAutoPreview() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ autoPreview: true }, (res) => {
      resolve(Boolean(res.autoPreview));
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ autoPreview: undefined }, (res) => {
    if (typeof res.autoPreview === 'undefined') {
      chrome.storage.local.set({ autoPreview: true });
    }
  });
});

chrome.downloads.onCreated.addListener(async (item) => {
  try {
    // Ignore downloads initiated by this extension to avoid loops
    if (item.byExtensionId && item.byExtensionId === chrome.runtime.id) return;

    const autoPreview = await getAutoPreview();
    if (!autoPreview) return;

    if (!item || !item.url || !isAllowedUrl(item.url)) return;

    // Cancel immediately to prevent the file hitting disk
    await chrome.downloads.cancel(item.id);

    // Fetch the same URL ourselves with credentials for Notion/S3
    const res = await fetch(item.url, { credentials: 'include' });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('pdf')) {
      throw new Error('Not a PDF or fetch failed');
    }

    const blob = await res.blob();
    const src = URL.createObjectURL(blob);

    const fileName = item.filename || 'notion-export.pdf';
    const viewerUrl =
      chrome.runtime.getURL('viewer/index.html') +
      `?src=${encodeURIComponent(src)}&orig=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(fileName)}`;

    await chrome.tabs.create({ url: viewerUrl });
  } catch (err) {
    // Fallback to the original download
    try {
      await chrome.downloads.download({ url: item.url });
    } catch (_) {
      // swallow
    }
  }
});

