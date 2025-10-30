/**
 * Offscreen Document
 * Service Worker에서 CORS 제한 없이 fetch를 실행하기 위한 백그라운드 컨텍스트
 * DOM 컨텍스트에서 실행되므로 Service Worker보다 CORS 제한이 덜함
 */

interface FetchMessage {
  type: "FETCH_PDF";
  url: string;
}

interface FetchResponse {
  type: "FETCH_SUCCESS" | "FETCH_ERROR";
  blobUrl?: string;
  error?: string;
}

/**
 * Service Worker로부터 메시지를 받아 PDF를 가져오는 리스너
 */
chrome.runtime.onMessage.addListener(
  (
    message: FetchMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: FetchResponse) => void
  ) => {
    if (message.type === "FETCH_PDF") {
      // 비동기 작업을 위해 Promise 사용
      fetchPdfWithCredentials(message.url)
        .then((blobUrl) => {
          sendResponse({ type: "FETCH_SUCCESS", blobUrl });
        })
        .catch((error) => {
          console.error("[Offscreen] Failed to fetch PDF:", error);
          sendResponse({
            type: "FETCH_ERROR",
            error: error.message || "Unknown error",
          });
        });

      // 비동기 응답을 위해 true 반환
      return true;
    }
  }
);

/**
 * 인증 정보(쿠키)를 포함하여 PDF를 가져오고 Blob URL을 생성하는 함수
 * @param url PDF 파일 URL
 * @returns Blob URL (브라우저 메모리에서 접근 가능한 URL)
 */
async function fetchPdfWithCredentials(url: string): Promise<string> {
  console.log("[Offscreen] Fetching PDF from:", url);

  // 인증 정보를 포함하여 PDF 다운로드
  const response = await fetch(url, {
    credentials: "include", // 쿠키 포함
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  console.log(`[Offscreen] PDF fetched successfully: ${blob.size} bytes`);

  // Blob URL 생성 (브라우저 메모리에서 접근 가능)
  const blobUrl = URL.createObjectURL(blob);

  return blobUrl;
}

console.log("[Offscreen] Document loaded and ready");