/**
 * Content Script - Notion 페이지에서 실행
 * Export 다이얼로그에 "Preview" 버튼을 추가
 */

/**
 * Preview 버튼이 이미 추가되었는지 추적
 */
let previewButtonAdded = false;

/**
 * URL에서 Notion 페이지 ID 추출 (유틸리티 함수 inline)
 */
function extractPageIdFromUrl(url: string): string | null {
  const match = url.match(/([a-f0-9]{32})/i);
  if (match) {
    const raw = match[1];
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return null;
}

/**
 * 쿠키에서 token_v2 추출 (유틸리티 함수 inline)
 */
function getTokenV2FromCookie(cookieString: string): string | null {
  const value = `; ${cookieString}`;
  const parts = value.split(`; token_v2=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

/**
 * Export 다이얼로그를 감지하고 Preview 버튼을 추가하는 함수
 */
function tryAddPreviewButton(): void {
  // 이미 버튼이 추가되었으면 중복 추가 방지
  if (previewButtonAdded) {
    return;
  }

  // Notion Export 다이얼로그의 Export 버튼을 찾기
  const exportButton = findExportButton();

  if (!exportButton) {
    return;
  }

  console.log("[Content Script] Export 버튼 발견, Preview 버튼 추가 중");

  // Preview 버튼 생성
  const previewButton = createPreviewButton();

  // Export 버튼 뒤에 Preview 버튼 추가
  exportButton.after(previewButton);
  previewButtonAdded = true;
  console.log("[Content Script] Preview 버튼 추가 완료");
}

/**
 * Export 다이얼로그를 찾는 함수
 */
function findExportDialog(): HTMLElement | null {
  // aria-label="내보내기"를 가진 다이얼로그 찾기
  const dialog = document.querySelector('[role="dialog"][aria-label="내보내기"]');
  if (dialog) {
    return dialog as HTMLElement;
  }

  // 영어 버전도 확인
  const dialogEn = document.querySelector('[role="dialog"][aria-label="Export"]');
  if (dialogEn) {
    return dialogEn as HTMLElement;
  }

  return null;
}

/**
 * Notion의 Export 버튼을 찾는 함수
 * 다이얼로그 내부에서만 검색하여 효율성 향상
 */
function findExportButton(): HTMLElement | null {
  // 1. Export 다이얼로그 찾기
  const dialog = findExportDialog();
  if (!dialog) {
    return null;
  }

  // 2. 다이얼로그 내부에서 role="button"인 요소들만 검색
  const buttons = dialog.querySelectorAll('[role="button"]');

  // 3. "내보내기" 또는 "Export" 텍스트를 가진 버튼 찾기
  for (const button of buttons) {
    const text = button.textContent?.trim() || "";

    if (text === "내보내기" || text === "Export") {
      console.log(`[Content Script] Export 버튼 발견: "${text}"`);
      return button as HTMLElement;
    }
  }

  return null;
}

/**
 * Preview 버튼을 생성하는 함수
 */
function createPreviewButton(): HTMLButtonElement {
  const button = document.createElement("button");

  // Notion 스타일 적용 (파란색 Primary 버튼)
  button.textContent = "미리보기";
  button.style.cssText = `
    user-select: none;
    transition: background 0.1s ease-in-out;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding-inline: 8px;
    border-radius: 6px;
    white-space: nowrap;
    font-size: 14px;
    justify-content: center;
    flex-shrink: 0;
    background:rgb(159, 96, 240);
    color: white;
    line-height: 1.2;
    font-weight: 500;
    border: none;
    margin-left: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
  `;

  // Hover 효과
  button.addEventListener("mouseenter", () => {
    button.style.background = "rgb(244, 228, 53)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background = "rgb(159, 96, 240)";
  });

  // 클릭 이벤트
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[Content Script] Preview 버튼 클릭됨");

    // 현재 설정된 배율 읽기
    const scaleInput = findScaleInput();
    const currentScale = scaleInput ? parseInt(scaleInput.value) : 100;
    console.log(`[Content Script] 현재 배율: ${currentScale}%`);

    // Service Worker에 preview mode 활성화 메시지 전송 (배율 정보 포함)
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ENABLE_PREVIEW_MODE",
        scale: currentScale,
      });

      if (response?.success) {
        console.log("[Content Script] 미리보기 모드 활성화됨");

        // Export 버튼을 자동으로 클릭
        const exportButton = findExportButton();
        if (exportButton) {
          exportButton.click();
        }
      }
    } catch (error) {
      console.error("[Content Script] 미리보기 모드 활성화 실패:", error);
      button.textContent = "오류 발생 ✗";
      button.style.background = "#EB5757";
      button.style.color = "white";

      // 3초 후 원래대로 복원
      setTimeout(() => {
        button.textContent = "미리보기";
        button.style.background = "#2383E2";
        button.style.color = "white";
      }, 3000);
    }
  });

  return button;
}

/**
 * MutationObserver로 DOM 변화를 감지
 * Export 다이얼로그가 실제로 추가됐을 때만 버튼 추가
 */
function observeDomChanges(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 추가된 노드들만 확인
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // 1. 추가된 노드 자체가 Export 다이얼로그인지 확인
          if (
            node.matches('[role="dialog"][aria-label="내보내기"]') ||
            node.matches('[role="dialog"][aria-label="Export"]')
          ) {
            console.log("[Content Script] Export 다이얼로그 감지 (직접)");
            tryAddPreviewButton();
            return;
          }

          // 2. 추가된 노드의 하위에 Export 다이얼로그가 있는지 확인
          const dialog =
            node.querySelector('[role="dialog"][aria-label="내보내기"]') ||
            node.querySelector('[role="dialog"][aria-label="Export"]');

          if (dialog) {
            console.log("[Content Script] Export 다이얼로그 감지 (하위 트리)");
            tryAddPreviewButton();
            return;
          }
        }
      }
    }
  });

  // body 전체를 관찰
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("[Content Script] DOM 감시 시작");
}

/**
 * 다이얼로그가 닫힐 때 플래그 리셋
 */
function observeDialogClose(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        // 다이얼로그가 제거되면 플래그 리셋
        if (
          node instanceof HTMLElement &&
          (node.querySelector("button") || node.tagName === "BUTTON")
        ) {
          previewButtonAdded = false;
          console.log("[Content Script] 다이얼로그 닫힘, 플래그 리셋");
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * 초기화
 */
function init(): void {
  console.log("[Content Script] Notion 페이지에서 초기화 중");
  console.log("[Content Script] 현재 URL:", window.location.href);

  // 페이지 로드 시 즉시 시도
  tryAddPreviewButton();

  // 1초 후 다시 시도 (Notion 완전 로드 대기)
  setTimeout(() => {
    console.log("[Content Script] 1초 후 재시도");
    tryAddPreviewButton();
  }, 1000);

  // DOM 변화 감지 시작
  observeDomChanges();
  observeDialogClose();
}

/**
 * Notion의 배율 입력 필드를 찾는 함수
 * 다이얼로그 내부에서만 검색하여 효율성 향상
 */
function findScaleInput(): HTMLInputElement | null {
  // 1. Export 다이얼로그 찾기
  const dialog = findExportDialog();
  if (!dialog) {
    console.log("[Content Script] Export 다이얼로그를 찾을 수 없음, 배율 입력 필드 검색 불가");
    return null;
  }

  // 2. 다이얼로그 내부의 input[type=text] 요소들만 검색
  const inputs = dialog.querySelectorAll('input[type=text]');
  console.log(`[Content Script] 다이얼로그에서 텍스트 입력 필드 ${inputs.length}개 발견`);

  // 3. text-align: end 스타일을 가진 입력 필드 찾기 (배율 필드)
  for (const input of inputs) {
    const style = window.getComputedStyle(input as HTMLElement);
    if (style.textAlign === 'end' || style.textAlign === 'right') {
      // 값이 숫자인지 확인 (배율 필드일 가능성)
      const value = (input as HTMLInputElement).value;
      if (value && !isNaN(parseInt(value))) {
        console.log(`[Content Script] 배율 입력 필드 발견, 값: ${value}`);
        return input as HTMLInputElement;
      }
    }
  }

  console.log("[Content Script] 다이얼로그에서 배율 입력 필드를 찾을 수 없음");
  return null;
}

/**
 * Notion의 배율을 변경하는 함수
 */
function setNotionScale(scale: number): boolean {
  console.log(`[Content Script] setNotionScale 호출됨, 배율: ${scale}%`);

  const input = findScaleInput();

  if (!input) {
    console.error("[Content Script] 배율 입력 필드를 찾을 수 없음 - Export 다이얼로그가 닫혔을 가능성");
    return false;
  }

  console.log("[Content Script] 배율 입력 필드 발견:", {
    currentValue: input.value,
    targetValue: scale.toString()
  });

  try {
    // 포커스
    input.focus();
    console.log("[Content Script] 입력 필드 포커스됨");

    // React 값 변경
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, scale.toString());
      console.log("[Content Script] 네이티브 setter 호출됨");
    }

    // 이벤트 발생
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log("[Content Script] 이벤트 발생 완료 (input, change)");

    // Blur
    input.blur();
    console.log("[Content Script] 입력 필드 블러 처리됨");

    console.log(`[Content Script] ✓ 배율이 ${scale}%로 변경됨`);
    return true;
  } catch (error) {
    console.error("[Content Script] ✗ 배율 변경 실패:", error);
    return false;
  }
}

/**
 * Notion 페이지 컨텍스트 추출
 * Private API 호출에 필요한 정보를 반환
 * (token과 spaceId는 Service Worker에서 조회)
 */
function getNotionContext(): {
  pageId: string;
} {
  // URL에서 페이지 ID 추출
  const pageId = extractPageIdFromUrl(window.location.href);
  if (!pageId) {
    throw new Error("URL에서 페이지 ID를 추출할 수 없습니다");
  }

  console.log("[Content Script] Notion 컨텍스트 추출됨:", { pageId });

  return { pageId };
}

/**
 * Service Worker로부터 메시지 수신
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Content Script] ===== Message received:", message.type, "=====");

  if (message.type === "GET_NOTION_CONTEXT") {
    // Private API 호출을 위한 컨텍스트 반환
    console.log("[Content Script] GET_NOTION_CONTEXT 요청됨");

    try {
      const context = getNotionContext();
      console.log("[Content Script] 컨텍스트 추출 완료");
      sendResponse({ success: true, context });
    } catch (error) {
      console.error("[Content Script] 컨텍스트 추출 실패:", error);
      sendResponse({ success: false, error: (error as Error).message });
    }

    return false; // 동기 응답
  }

  if (message.type === "CHANGE_SCALE") {
    const { scale } = message;
    console.log(`[Content Script] 배율 변경 요청: ${scale}%`);

    // 배율 변경
    console.log("[Content Script] 1단계: 배율 변경 시도 중...");
    const success = setNotionScale(scale);
    console.log(`[Content Script] 1단계 결과: ${success ? "성공" : "실패"}`);

    if (success) {
      // Preview mode 활성화
      console.log("[Content Script] 2단계: 미리보기 모드 활성화 중...");
      chrome.runtime.sendMessage({ type: "ENABLE_PREVIEW_MODE" }, (response) => {
        console.log("[Content Script] 2단계 결과:", response);
      });

      // 약간의 지연 후 Export 버튼 클릭
      console.log("[Content Script] 3단계: Export 버튼 클릭 전 500ms 대기 중...");
      setTimeout(() => {
        console.log("[Content Script] 3단계: Export 버튼 검색 중...");
        const exportButton = findExportButton();

        if (exportButton) {
          console.log("[Content Script] 3단계: Export 버튼 발견, 클릭 시도 중...");
          exportButton.click();
          console.log("[Content Script] 3단계 결과: Export 버튼 클릭 완료");
          sendResponse({ success: true });
        } else {
          console.error("[Content Script] 3단계 결과: Export 버튼을 찾을 수 없음");
          sendResponse({ success: false, error: "Export 버튼을 찾을 수 없습니다" });
        }
      }, 500);

      return true; // 비동기 응답
    } else {
      console.error("[Content Script] 1단계 실패: 배율 변경 불가");
      sendResponse({ success: false, error: "배율 변경에 실패했습니다" });
      return false;
    }
  }

  return false;
});

// DOM이 준비되면 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
