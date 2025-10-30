/**
 * Notion Export Preview Extension의 Service Worker
 * Notion에서 PDF 다운로드를 감지하고 미리보기 뷰어를 여는 역할
 */

import { isNotionExport } from "../utils/urlFilter";
import { fetchWithCredentials } from "../utils/fetchWithCreds";

/**
 * 다운로드 이벤트를 감지하여 Notion PDF 내보내기를 가로채는 리스너
 * 다운로드를 취소하고 미리보기 뷰어로 대체함
 */
chrome.downloads.onCreated.addListener(async (item: chrome.downloads.DownloadItem) => {
  console.log("[Service Worker] Download detected:", item.url);

  // 필터링: Notion PDF 내보내기인지 확인
  if (!item.url || !isNotionExport(item.url)) {
    console.log("[Service Worker] Not a Notion export, ignoring");
    return;
  }

  console.log("[Service Worker] Notion export detected, intercepting...");

  try {
    // 디스크 저장 방지를 위해 즉시 다운로드 취소
    await chrome.downloads.cancel(item.id);
    console.log("[Service Worker] Download canceled:", item.id);

    // 인증 정보를 포함하여 PDF를 직접 가져옴
    const blob = await fetchWithCredentials(item.url);
    console.log("[Service Worker] PDF fetched successfully, size:", blob.size);

    // Blob URL 생성
    const blobUrl = URL.createObjectURL(blob);

    // Blob URL과 함께 뷰어 탭 열기
    const viewerUrl = chrome.runtime.getURL("src/viewer/index.html");
    const fullUrl = `${viewerUrl}?src=${encodeURIComponent(blobUrl)}&filename=${encodeURIComponent(item.filename || "export.pdf")}`;

    await chrome.tabs.create({ url: fullUrl });
    console.log("[Service Worker] Viewer tab opened");
  } catch (error) {
    console.error("[Service Worker] Failed to process download:", error);

    // 폴백: 원래 다운로드 재개
    try {
      await chrome.downloads.download({ url: item.url });
      console.log("[Service Worker] Fallback: Original download resumed");
    } catch (fallbackError) {
      console.error("[Service Worker] Fallback failed:", fallbackError);
    }
  }
});

/**
 * 확장 프로그램 설치/업데이트 이벤트 처리
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Service Worker] Extension installed/updated:", details.reason);
});

console.log("[Service Worker] Initialized");
