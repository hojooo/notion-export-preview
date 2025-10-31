/**
 * Notion Export Preview Extension의 Service Worker
 * Content Script와 협력하여 Preview 모드에서만 다운로드를 가로채는 역할
 */

import { isNotionExport } from "../utils/urlFilter";
import { exportPageWithScale } from "../utils/notionPrivateApi";

/**
 * Preview mode 플래그
 * true일 때만 다음 다운로드를 가로채서 미리보기
 */
let previewModeEnabled = false;

/**
 * Notion Tab ID 저장 (배율 변경 시 필요)
 */
let notionTabId: number | null = null;

/**
 * 현재 요청된 배율 (Viewer에서 슬라이더로 변경 시)
 */
let requestedScale: number | null = null;

/**
 * 초기 배율 (미리보기 버튼 클릭 시 설정된 배율)
 */
let initialScale: number = 100;

/**
 * Viewer Tab ID 저장 (PDF URL 전달용)
 */
let viewerTabId: number | null = null;

/**
 * Offscreen document가 이미 생성되었는지 추적
 * 현재 사용되지 않음 (URL 직접 전달 방식으로 변경)
 */
// let offscreenDocumentCreated = false;

/**
 * Offscreen document를 생성하거나 이미 존재하는지 확인
 * 현재 사용되지 않음 (URL 직접 전달 방식으로 변경)
 */
/*
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
*/

/**
 * Offscreen document를 통해 PDF를 가져오는 함수
 * 현재 사용되지 않음 (URL 직접 전달 방식으로 변경)
 * @param url PDF 파일 URL
 * @returns Blob URL
 */
/*
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
*/

/**
 * Content Script로부터 메시지를 수신하는 리스너
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Service Worker] 메시지 수신:", message.type);

  if (message.type === "ENABLE_PREVIEW_MODE") {
    // Preview mode 활성화
    previewModeEnabled = true;

    // Notion Tab ID 저장 (Content Script에서 보낸 경우)
    if (sender.tab?.id) {
      notionTabId = sender.tab.id;
      console.log("[Service Worker] Notion 탭 ID 저장됨:", notionTabId);
    }

    // 초기 배율 저장
    initialScale = message.scale || 100;
    console.log(`[Service Worker] 초기 배율 저장됨: ${initialScale}%`);

    console.log("[Service Worker] 미리보기 모드 활성화됨");

    // Content Script에 성공 응답
    sendResponse({ success: true });

    return true; // 비동기 응답을 위해 true 반환
  }

  if (message.type === "REQUEST_SCALE_CHANGE") {
    // Viewer에서 배율 변경 요청
    const { scale, notionTabId: tabId } = message;

    console.log(`[Service Worker] ===== REQUEST_SCALE_CHANGE 수신 =====`);
    console.log(`[Service Worker] 배율: ${scale}%`);
    console.log(`[Service Worker] Notion 탭 ID: ${tabId}`);

    // Viewer Tab ID 저장
    if (sender.tab?.id) {
      viewerTabId = sender.tab.id;
      console.log(`[Service Worker] 뷰어 탭 ID 저장됨: ${viewerTabId}`);
    }

    requestedScale = scale;
    console.log(`[Service Worker] 요청된 배율 저장됨: ${requestedScale}%`);

    // Private API 방식으로 시도
    if (tabId) {
      console.log(`[Service Worker] Private API 방식 시도 중...`);

      // 비동기 처리
      (async () => {
        try {
          // 1. Content Script에서 Notion 컨텍스트 가져오기
          console.log(`[Service Worker] 탭 ${tabId}에서 Notion 컨텍스트 요청 중...`);
          const contextResponse = await chrome.tabs.sendMessage(tabId, {
            type: "GET_NOTION_CONTEXT",
          });

          if (!contextResponse?.success) {
            throw new Error(contextResponse?.error || "Notion 컨텍스트를 가져오지 못했습니다");
          }

          const { pageId } = contextResponse.context;
          console.log(`[Service Worker] ✓ pageId 획득 완료: ${pageId}`);

          // 2. chrome.cookies API로 token_v2 획득 (HttpOnly 쿠키 접근)
          console.log(`[Service Worker] 쿠키에서 token_v2 가져오는 중...`);
          const cookie = await chrome.cookies.get({
            url: "https://www.notion.so",
            name: "token_v2",
          });

          if (!cookie || !cookie.value) {
            throw new Error("토큰을 찾을 수 없습니다. Notion에 로그인해주세요.");
          }

          const token = cookie.value;
          console.log(`[Service Worker] ✓ token_v2 획득 완료`);

          // 3. Private API로 Export 생성 (scale을 0.1~2.0 범위로 변환)
          console.log(`[Service Worker] Private API 호출 중, 배율: ${scale / 100}...`);
          const exportURL = await exportPageWithScale({
            pageId,
            scale: scale / 100, // 55 → 0.55
            token,
          });

          console.log(`[Service Worker] ✓ Private API 성공: ${exportURL}`);

          // 3. Viewer에 URL 전달
          if (viewerTabId) {
            chrome.tabs.sendMessage(viewerTabId, {
              type: "NEW_SCALE_PDF",
              scale: scale,
              url: exportURL,
            });
          }

          sendResponse({ success: true, method: "private-api" });
        } catch (error) {
          // Private API 실패 - 사용자에게 에러 알림
          console.error(
            "[Service Worker] ✗ Private API 실패:",
            error
          );

          const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
          sendResponse({
            success: false,
            error: errorMessage,
          });
        }
      })();

      return true; // 비동기 응답
    } else {
      console.error("[Service Worker] ✗ Notion 탭 ID가 제공되지 않음");
      sendResponse({ success: false, error: "Notion 탭 ID를 찾을 수 없습니다" });
      return false;
    }
  }

  // Offscreen document로부터의 메시지는 그대로 전달
  return false;
});

/**
 * 다운로드 이벤트를 감지하여 Preview mode일 때만 가로채는 리스너
 */
chrome.downloads.onCreated.addListener(
  async (item: chrome.downloads.DownloadItem) => {
    console.log("[Service Worker] 다운로드 감지됨:", item.url);

    // Preview mode가 아니면 무시
    if (!previewModeEnabled) {
      console.log("[Service Worker] 미리보기 모드 비활성화됨, 무시");
      return;
    }

    // Notion export가 아니면 무시
    if (!item.url || !isNotionExport(item.url)) {
      console.log("[Service Worker] Notion export가 아님, 무시");
      return;
    }

    console.log(
      "[Service Worker] 미리보기 모드 활성화됨, 다운로드 가로채는 중..."
    );

    // Preview mode 즉시 비활성화 (1회만 실행)
    previewModeEnabled = false;

    try {
      // 디스크 저장 방지를 위해 즉시 다운로드 취소
      await chrome.downloads.cancel(item.id);
      console.log("[Service Worker] 다운로드 취소됨:", item.id);

      // 배율 변경 요청인지 확인
      const isScaleChange = requestedScale !== null;

      if (isScaleChange && viewerTabId) {
        // 배율 변경 요청인 경우: 기존 Viewer에 메시지 전송
        console.log(`[Service Worker] 뷰어로 PDF URL 전송 중 (배율: ${requestedScale}%)`);

        chrome.tabs.sendMessage(viewerTabId, {
          type: "NEW_SCALE_PDF",
          scale: requestedScale,
          url: item.url
        });

        requestedScale = null; // 초기화
      } else {
        // 초기 미리보기인 경우: 새 Viewer 탭 생성
        const viewerUrl = chrome.runtime.getURL("src/viewer/index.html");
        const filename = item.filename || "export.pdf";
        const tabIdParam = notionTabId ? `&tabId=${notionTabId}` : "";
        const scaleParam = `&scale=${initialScale}`;
        const fullUrl = `${viewerUrl}?src=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(filename)}${tabIdParam}${scaleParam}`;

        const tab = await chrome.tabs.create({ url: fullUrl });
        viewerTabId = tab.id || null;
        console.log(`[Service Worker] 뷰어 탭 열림, 배율: ${initialScale}%`);
      }

      // 성공 badge 표시
      await chrome.action.setBadgeText({ text: "✓" });
      await chrome.action.setBadgeBackgroundColor({ color: "#28a745" });

      // 3초 후 badge 제거
      setTimeout(async () => {
        await chrome.action.setBadgeText({ text: "" });
      }, 3000);
    } catch (error) {
      console.error("[Service Worker] PDF 미리보기 실패:", error);

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
        "[Service Worker] 미리보기 실패. 일반 다운로드를 시도해주세요."
      );
    }
  }
);

/**
 * 확장 프로그램 설치/업데이트 이벤트 처리
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Service Worker] 확장 프로그램 설치/업데이트됨:", details.reason);
});

console.log("[Service Worker] 초기화 완료");
