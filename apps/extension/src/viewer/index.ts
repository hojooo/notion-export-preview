/**
 * PDF 뷰어 - PDF.js를 사용하여 PDF 미리보기 표시
 */

import * as pdfjsLib from "pdfjs-dist";
import "./viewer.css";

/**
 * PDF.js Worker 경로 설정
 * Chrome 확장 프로그램 내부 경로를 사용
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "pdfjs-dist/build/pdf.worker.js"
);

/**
 * URL 파라미터에서 PDF 소스와 파일명, 배율 추출
 */
const urlParams = new URLSearchParams(window.location.search);
const pdfSrc = urlParams.get("src");
const filename = urlParams.get("filename") || "export.pdf";
const notionTabId = parseInt(urlParams.get("tabId") || "0");
const initialScale = parseInt(urlParams.get("scale") || "100");

/**
 * 파일명을 UI에 표시
 */
const filenameElement = document.getElementById("filename");
if (filenameElement) {
  filenameElement.textContent = filename;
}

/**
 * 배율별 PDF URL 캐시
 */
const pdfCache = new Map<number, string>();
let currentScale = initialScale;

// 초기 PDF를 캐시에 저장
if (pdfSrc) {
  pdfCache.set(initialScale, pdfSrc);
  console.log(`[Viewer] 초기 배율: ${initialScale}%`);
}

/**
 * PDF를 렌더링하는 메인 함수
 * 모든 페이지를 Canvas 요소로 변환하여 표시
 */
async function renderPDF(url: string = pdfSrc || "") {
  if (!url) {
    console.error("PDF 소스가 제공되지 않았습니다");
    return;
  }

  try {
    // 기존 PDF 제거
    const container = document.getElementById("pdf-viewer");
    if (!container) return;
    container.innerHTML = "";

    // PDF 문서 로드
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;

    console.log("PDF 로드 완료, 페이지 수:", pdf.numPages);

    // 모든 페이지 렌더링
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      // 해당 페이지용 Canvas 생성
      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page";
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // 페이지 렌더링
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      container.appendChild(canvas);
    }
  } catch (error) {
    console.error("PDF 렌더링 오류:", error);
    alert("PDF 미리보기 로드 실패. 원본 파일을 다운로드해주세요.");
  }
}

/**
 * 저장 버튼 클릭 핸들러
 * Chrome downloads API를 사용하여 파일 다운로드
 */
document.getElementById("save-btn")?.addEventListener("click", () => {
  if (!pdfSrc) return;

  chrome.downloads.download({
    url: pdfSrc,
    filename: filename,
    saveAs: true,
  });
});


/**
 * 배율 변경 요청 함수
 */
async function requestScaleChange(scale: number) {
  const statusElement = document.getElementById("scale-status");

  // 이미 캐시에 있으면 즉시 표시
  if (pdfCache.has(scale)) {
    if (statusElement) statusElement.textContent = "완료!";
    const url = pdfCache.get(scale)!;
    await renderPDF(url);
    if (statusElement) {
      setTimeout(() => {
        statusElement.textContent = "";
      }, 1000);
    }
    return;
  }

  // 캐시에 없으면 생성 요청
  if (statusElement) statusElement.textContent = "PDF 렌더링 요청 중";

  try {
    // Service Worker에 배율 변경 요청
    const response = await chrome.runtime.sendMessage({
      type: "REQUEST_SCALE_CHANGE",
      scale: scale,
      notionTabId: notionTabId,
    });

    if (response?.success) {
      // Private API 성공
      console.log("[Viewer] Private API 방식 사용 중");
      if (statusElement) statusElement.textContent = "PDF 렌더링 중..";
    } else {
      // Private API 실패
      const errorMsg = response?.error || "배율 변경 요청 실패";
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error("[Viewer] 배율 변경 요청 실패:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";

    // 사용자에게 에러 메시지 표시
    if (statusElement) {
      statusElement.textContent = `❌ ${errorMessage}`;
      statusElement.style.color = "#dc3545";

      // 5초 후 원래대로 복원
      setTimeout(() => {
        if (statusElement) {
          statusElement.textContent = "";
          statusElement.style.color = "";
        }
      }, 5000);
    }
  }
}

/**
 * 배율 입력 필드 이벤트 리스너
 */
const scaleSlider = document.getElementById("scale-slider") as HTMLInputElement;
const scaleValueElement = document.getElementById("scale-value");

if (scaleSlider && scaleValueElement) {
  // 입력 필드 초기값 설정
  scaleSlider.value = initialScale.toString();
  scaleValueElement.textContent = initialScale.toString();
  console.log(`[Viewer] 배율 입력 필드 초기값: ${initialScale}%`);

  // 입력 값 변경 시 실시간 표시 업데이트
  scaleSlider.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    scaleValueElement.textContent = value;
  });

  // Enter 키 또는 포커스 아웃 시 배율 변경 요청
  scaleSlider.addEventListener("change", async (e) => {
    let value = parseInt((e.target as HTMLInputElement).value);

    // 범위 검증 (10~200)
    if (isNaN(value)) {
      value = currentScale; // 잘못된 입력이면 현재 값 유지
    } else if (value < 10) {
      value = 10;
      console.log("[Viewer] 배율이 최소값으로 조정됨: 10%");
    } else if (value > 200) {
      value = 200;
      console.log("[Viewer] 배율이 최대값으로 조정됨: 200%");
    }

    // 입력 필드 값 보정
    scaleSlider.value = value.toString();
    scaleValueElement.textContent = value.toString();

    if (value !== currentScale) {
      currentScale = value;
      await requestScaleChange(value);
    }
  });
}

/**
 * Service Worker로부터 새로운 PDF URL 수신
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "NEW_SCALE_PDF") {
    const { scale, url } = message;
    console.log(`[Viewer] 배율 ${scale}% PDF 수신됨`);

    // 캐시에 저장
    pdfCache.set(scale, url);

    // 현재 요청한 배율이면 렌더링
    if (scale === currentScale) {
      renderPDF(url);
      const statusElement = document.getElementById("scale-status");
      if (statusElement) {
        statusElement.textContent = "완료!";
        setTimeout(() => {
          statusElement.textContent = "";
        }, 2000);
      }
    }

    sendResponse({ success: true });
  }
});

/**
 * 페이지 로드 시 PDF 렌더링 시작
 */
renderPDF();
