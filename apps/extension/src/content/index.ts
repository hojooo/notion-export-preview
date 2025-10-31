/**
 * Content Script - Notion 페이지에서 실행
 * Export 다이얼로그에 "Preview" 버튼을 추가
 */

/**
 * Preview 버튼이 이미 추가되었는지 추적
 */
let previewButtonAdded = false;

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

  console.log("[Content Script] Export button found, adding Preview button");

  // Preview 버튼 생성
  const previewButton = createPreviewButton();

  // Export 버튼 뒤에 Preview 버튼 추가
  exportButton.after(previewButton);
  previewButtonAdded = true;
  console.log("[Content Script] Preview button added successfully");
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
      console.log(`[Content Script] Export button found: "${text}"`);
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

    console.log("[Content Script] Preview button clicked");

    // 현재 설정된 배율 읽기
    const scaleInput = findScaleInput();
    const currentScale = scaleInput ? parseInt(scaleInput.value) : 100;
    console.log(`[Content Script] Current scale: ${currentScale}%`);

    // Service Worker에 preview mode 활성화 메시지 전송 (배율 정보 포함)
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ENABLE_PREVIEW_MODE",
        scale: currentScale,
      });

      if (response?.success) {
        console.log("[Content Script] Preview mode enabled");

        // Export 버튼을 자동으로 클릭
        const exportButton = findExportButton();
        if (exportButton) {
          setTimeout(() => {
            exportButton.click();
          }, 10);
        }
      }
    } catch (error) {
      console.error("[Content Script] Failed to enable preview mode:", error);
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
            console.log("[Content Script] Export dialog detected (direct)");
            tryAddPreviewButton();
            return;
          }

          // 2. 추가된 노드의 하위에 Export 다이얼로그가 있는지 확인
          const dialog =
            node.querySelector('[role="dialog"][aria-label="내보내기"]') ||
            node.querySelector('[role="dialog"][aria-label="Export"]');

          if (dialog) {
            console.log("[Content Script] Export dialog detected (in subtree)");
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

  console.log("[Content Script] DOM observer started");
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
          console.log("[Content Script] Dialog closed, flag reset");
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
  console.log("[Content Script] Initializing on Notion page");
  console.log("[Content Script] Current URL:", window.location.href);

  // 페이지 로드 시 즉시 시도
  tryAddPreviewButton();

  // 1초 후 다시 시도 (Notion 완전 로드 대기)
  setTimeout(() => {
    console.log("[Content Script] Retry after 1 second");
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
    console.log("[Content Script] Export dialog not found, cannot find scale input");
    return null;
  }

  // 2. 다이얼로그 내부의 input[type=text] 요소들만 검색
  const inputs = dialog.querySelectorAll('input[type=text]');
  console.log(`[Content Script] Found ${inputs.length} text inputs in dialog`);

  // 3. text-align: end 스타일을 가진 입력 필드 찾기 (배율 필드)
  for (const input of inputs) {
    const style = window.getComputedStyle(input as HTMLElement);
    if (style.textAlign === 'end' || style.textAlign === 'right') {
      // 값이 숫자인지 확인 (배율 필드일 가능성)
      const value = (input as HTMLInputElement).value;
      if (value && !isNaN(parseInt(value))) {
        console.log(`[Content Script] Scale input found with value: ${value}`);
        return input as HTMLInputElement;
      }
    }
  }

  console.log("[Content Script] Scale input not found in dialog");
  return null;
}

/**
 * Notion의 배율을 변경하는 함수
 */
function setNotionScale(scale: number): boolean {
  console.log(`[Content Script] setNotionScale called with scale: ${scale}%`);

  const input = findScaleInput();

  if (!input) {
    console.error("[Content Script] Scale input not found - Export dialog may be closed");
    return false;
  }

  console.log("[Content Script] Scale input found:", {
    currentValue: input.value,
    targetValue: scale.toString()
  });

  try {
    // 포커스
    input.focus();
    console.log("[Content Script] Input focused");

    // React 값 변경
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, scale.toString());
      console.log("[Content Script] Native setter called");
    }

    // 이벤트 발생
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log("[Content Script] Events dispatched (input, change)");

    // Blur
    input.blur();
    console.log("[Content Script] Input blurred");

    console.log(`[Content Script] ✓ Scale successfully changed to ${scale}%`);
    return true;
  } catch (error) {
    console.error("[Content Script] ✗ Failed to set scale:", error);
    return false;
  }
}

/**
 * Service Worker로부터 메시지 수신
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Content Script] ===== Message received:", message.type, "=====");

  if (message.type === "CHANGE_SCALE") {
    const { scale } = message;
    console.log(`[Content Script] Scale change requested: ${scale}%`);

    // 배율 변경
    console.log("[Content Script] Step 1: Attempting to change scale...");
    const success = setNotionScale(scale);
    console.log(`[Content Script] Step 1 Result: ${success ? "SUCCESS" : "FAILED"}`);

    if (success) {
      // Preview mode 활성화
      console.log("[Content Script] Step 2: Enabling preview mode...");
      chrome.runtime.sendMessage({ type: "ENABLE_PREVIEW_MODE" }, (response) => {
        console.log("[Content Script] Step 2 Result:", response);
      });

      // 약간의 지연 후 Export 버튼 클릭
      console.log("[Content Script] Step 3: Waiting 500ms before clicking Export button...");
      setTimeout(() => {
        console.log("[Content Script] Step 3: Searching for Export button...");
        const exportButton = findExportButton();

        if (exportButton) {
          console.log("[Content Script] Step 3: Export button FOUND, attempting to click...");
          exportButton.click();
          console.log("[Content Script] Step 3 Result: Export button clicked successfully");
          sendResponse({ success: true });
        } else {
          console.error("[Content Script] Step 3 Result: Export button NOT FOUND");
          sendResponse({ success: false, error: "Export button not found" });
        }
      }, 500);

      return true; // 비동기 응답
    } else {
      console.error("[Content Script] Failed at Step 1: Could not change scale");
      sendResponse({ success: false, error: "Failed to change scale" });
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
