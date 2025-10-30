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

/**
 * 파일명을 UI에 표시
 */
const filenameElement = document.getElementById("filename");
if (filenameElement) {
  filenameElement.textContent = filename;
}

/**
 * PDF를 렌더링하는 메인 함수
 * 모든 페이지를 Canvas 요소로 변환하여 표시
 */
async function renderPDF() {
  if (!pdfSrc) {
    console.error("No PDF source provided");
    return;
  }

  try {
    // PDF 문서 로드
    const loadingTask = pdfjsLib.getDocument(pdfSrc);
    const pdf = await loadingTask.promise;

    console.log("PDF loaded, pages:", pdf.numPages);

    const container = document.getElementById("pdf-viewer");
    if (!container) return;

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
 * 페이지 로드 시 PDF 렌더링 시작
 */
renderPDF();
