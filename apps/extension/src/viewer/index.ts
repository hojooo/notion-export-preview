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
 * URL 파라미터에서 PDF 소스와 파일명 추출
 */
const urlParams = new URLSearchParams(window.location.search);
const pdfSrc = urlParams.get("src");
const filename = urlParams.get("filename") || "export.pdf";
const notionTabId = parseInt(urlParams.get("tabId") || "0");

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
let currentScale = 100;

// 초기 PDF를 캐시에 저장
if (pdfSrc) {
  pdfCache.set(100, pdfSrc);
}

/**
 * PDF를 렌더링하는 메인 함수
 * 모든 페이지를 Canvas 요소로 변환하여 표시
 */
async function renderPDF(url: string = pdfSrc || "") {
  if (!url) {
    console.error("No PDF source provided");
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

    console.log("PDF loaded, pages:", pdf.numPages);

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
    console.error("Error rendering PDF:", error);
    alert("Failed to load PDF preview. Please try downloading the original file.");
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
 * 인쇄 버튼 클릭 핸들러
 */
document.getElementById("print-btn")?.addEventListener("click", () => {
  window.print();
});

/**
 * 원본 다운로드 버튼 클릭 핸들러
 * TODO: 원본 URL 저장 기능 구현 필요
 */
document.getElementById("download-original-btn")?.addEventListener("click", () => {
  // 원본 URL 저장 기능이 필요함
  // 현재는 안내 메시지만 표시
  alert("Original download feature coming soon!");
});

/**
 * 배율 변경 요청 함수
 */
async function requestScaleChange(scale: number) {
  const statusElement = document.getElementById("scale-status");

  // 이미 캐시에 있으면 즉시 표시
  if (pdfCache.has(scale)) {
    if (statusElement) statusElement.textContent = "Cached";
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
  if (statusElement) statusElement.textContent = "Generating...";

  try {
    // Service Worker에 배율 변경 요청
    const response = await chrome.runtime.sendMessage({
      type: "REQUEST_SCALE_CHANGE",
      scale: scale,
      notionTabId: notionTabId,
    });

    if (response?.success) {
      // 다운로드가 시작되면 대기
      console.log("[Viewer] Scale change requested successfully");
    } else {
      throw new Error(response?.error || "Failed to request scale change");
    }
  } catch (error) {
    console.error("[Viewer] Failed to request scale change:", error);
    if (statusElement) statusElement.textContent = "Error";
    setTimeout(() => {
      if (statusElement) statusElement.textContent = "";
    }, 3000);
  }
}

/**
 * 슬라이더 이벤트 리스너
 */
const scaleSlider = document.getElementById("scale-slider") as HTMLInputElement;
const scaleValueElement = document.getElementById("scale-value");

if (scaleSlider && scaleValueElement) {
  // 슬라이더 값 변경 시 표시 업데이트
  scaleSlider.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    scaleValueElement.textContent = value;
  });

  // 슬라이더 드래그 종료 시 배율 변경 요청
  scaleSlider.addEventListener("change", async (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    if (value !== currentScale) {
      currentScale = value;
      await requestScaleChange(value);
    }
  });
}

/**
 * Service Worker로부터 새로운 PDF URL 수신
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_SCALE_PDF") {
    const { scale, url } = message;
    console.log(`[Viewer] Received PDF for scale ${scale}%`);

    // 캐시에 저장
    pdfCache.set(scale, url);

    // 현재 요청한 배율이면 렌더링
    if (scale === currentScale) {
      renderPDF(url);
      const statusElement = document.getElementById("scale-status");
      if (statusElement) {
        statusElement.textContent = "Done!";
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
