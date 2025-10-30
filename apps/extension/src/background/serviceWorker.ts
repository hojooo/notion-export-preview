/**
 * Notion Export Preview Extension의 Service Worker
 * Content Script와 협력하여 Preview 모드에서만 다운로드를 가로채는 역할
 */

import { isNotionExport } from "../utils/urlFilter";

/**
 * Preview mode 플래그
 * true일 때만 다음 다운로드를 가로채서 미리보기
 */
let previewModeEnabled = false;

/**
 * Offscreen document가 이미 생성되었는지 추적
 */
let offscreenDocumentCreated = false;

/**
 * Offscreen document를 생성하거나 이미 존재하는지 확인
 */
async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenDocumentCreated) {
    return;
  }

  try {
    // Offscreen document 생성
    // 이미 존재하면 에러가 발생하므로 catch에서 처리
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("src/offscreen/index.html"),
      reasons: ["BLOBS" as chrome.offscreen.Reason],
      justification: "CORS 제한 없이 Notion PDF를 가져오기 위해 필요합니다",
    });

    offscreenDocumentCreated = true;
    console.log("[Service Worker] Offscreen document created");
  } catch (error) {
    // 이미 존재하는 경우 에러를 무시
    if (
      error instanceof Error &&
      error.message.includes("Only a single offscreen")
    ) {
      offscreenDocumentCreated = true;
      console.log("[Service Worker] Offscreen document already exists");
    } else {
      throw error;
    }
  }
}

/**
 * Offscreen document를 통해 PDF를 가져오는 함수
 * @param url PDF 파일 URL
 * @returns Blob URL
 */
async function fetchPdfViaOffscreen(url: string): Promise<string> {
  // Offscreen document가 준비되었는지 확인
  await ensureOffscreenDocument();

  // Offscreen document에 메시지 전송
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "FETCH_PDF", url },
      (response: { type: string; blobUrl?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response.type === "FETCH_SUCCESS" && response.blobUrl) {
          resolve(response.blobUrl);
        } else if (response.type === "FETCH_ERROR") {
          reject(new Error(response.error || "Unknown error"));
        } else {
          reject(new Error("Invalid response from offscreen document"));
        }
      }
    );
  });
}

/**
 * Content Script로부터 메시지를 수신하는 리스너
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Service Worker] Message received:", message.type);

  if (message.type === "ENABLE_PREVIEW_MODE") {
    // Preview mode 활성화
    previewModeEnabled = true;
    console.log("[Service Worker] Preview mode enabled");

    // Content Script에 성공 응답
    sendResponse({ success: true });

    // 10초 후 자동으로 비활성화 (타임아웃)
    setTimeout(() => {
      if (previewModeEnabled) {
        console.log("[Service Worker] Preview mode timed out");
        previewModeEnabled = false;
      }
    }, 10000);

    return true; // 비동기 응답을 위해 true 반환
  }

  // Offscreen document로부터의 메시지는 그대로 전달
  return false;
});

/**
 * 다운로드 이벤트를 감지하여 Preview mode일 때만 가로채는 리스너
 */
chrome.downloads.onCreated.addListener(
  async (item: chrome.downloads.DownloadItem) => {
    console.log("[Service Worker] Download detected:", item.url);

    // Preview mode가 아니면 무시
    if (!previewModeEnabled) {
      console.log("[Service Worker] Preview mode disabled, ignoring");
      return;
    }

    // Notion export가 아니면 무시
    if (!item.url || !isNotionExport(item.url)) {
      console.log("[Service Worker] Not a Notion export, ignoring");
      return;
    }

    console.log(
      "[Service Worker] Preview mode active, intercepting download..."
    );

    // Preview mode 즉시 비활성화 (1회만 실행)
    previewModeEnabled = false;

    try {
      // 디스크 저장 방지를 위해 즉시 다운로드 취소
      await chrome.downloads.cancel(item.id);
      console.log("[Service Worker] Download canceled:", item.id);

      // Offscreen document를 통해 PDF를 가져옴
      const blobUrl = await fetchPdfViaOffscreen(item.url);
      console.log("[Service Worker] PDF fetched successfully via offscreen");

      // Blob URL과 함께 뷰어 탭 열기
      const viewerUrl = chrome.runtime.getURL("src/viewer/index.html");
      const filename = item.filename || "export.pdf";
      const fullUrl = `${viewerUrl}?src=${encodeURIComponent(blobUrl)}&filename=${encodeURIComponent(filename)}`;

      await chrome.tabs.create({ url: fullUrl });
      console.log("[Service Worker] Viewer tab opened");

      // 성공 badge 표시
      await chrome.action.setBadgeText({ text: "✓" });
      await chrome.action.setBadgeBackgroundColor({ color: "#28a745" });

      // 3초 후 badge 제거
      setTimeout(async () => {
        await chrome.action.setBadgeText({ text: "" });
      }, 3000);
    } catch (error) {
      console.error("[Service Worker] Failed to preview PDF:", error);

      // 에러 badge 표시
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#dc3545" });

      // 5초 후 badge 제거
      setTimeout(async () => {
        await chrome.action.setBadgeText({ text: "" });
      }, 5000);

      // Fallback 없음: 사용자에게 알림만 표시
      // 다운로드를 재시작하지 않음 (무한 루프 방지)
      console.warn(
        "[Service Worker] Preview failed. Please try downloading normally."
      );
    }
  }
);

/**
 * 확장 프로그램 설치/업데이트 이벤트 처리
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Service Worker] Extension installed/updated:", details.reason);
});

console.log("[Service Worker] Initialized");
