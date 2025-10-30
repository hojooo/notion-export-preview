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
 * Notion의 Export 버튼을 찾는 함수
 * Notion UI는 자주 변경되므로 여러 방법을 시도
 */
function findExportButton(): HTMLElement | null {
  console.log("[Content Script] Searching for Export button...");

  // 1. 모든 버튼을 순회하면서 "Export" 텍스트를 포함하는 버튼 찾기
  const allButtons = document.querySelectorAll("button");
  console.log(`[Content Script] Found ${allButtons.length} buttons on page`);

  for (const button of allButtons) {
    const text = button.textContent?.trim().toLowerCase() || "";
    const ariaLabel = button.getAttribute("aria-label")?.toLowerCase() || "";

    if (
      text === "export" ||
      text.includes("export") ||
      ariaLabel.includes("export")
    ) {
      console.log("[Content Script] Export button found via button tag:", {
        text,
        ariaLabel,
      });
      return button as HTMLElement;
    }
  }

  // 2. div 요소 중에서 role이 button이고 Export 텍스트를 포함하는 것 찾기
  const divButtons = document.querySelectorAll('div[role="button"]');
  console.log(
    `[Content Script] Found ${divButtons.length} div[role="button"] elements`
  );

  // 디버깅: 모든 div[role="button"]의 텍스트 출력
  divButtons.forEach((div, index) => {
    const text = div.textContent?.trim() || "";
    if (text.length > 0 && text.length < 50) {
      // 너무 긴 텍스트는 제외
      console.log(`[Content Script] Button ${index}: "${text}"`);
    }
  });

  for (const div of divButtons) {
    const text = div.textContent?.trim().toLowerCase() || "";
    const ariaLabel = div.getAttribute("aria-label")?.toLowerCase() || "";

    // Export 또는 내보내기 확인
    if (
      text === "export" ||
      text.includes("export") ||
      text === "내보내기" ||
      text.includes("내보내기") ||
      ariaLabel.includes("export") ||
      ariaLabel.includes("내보내기")
    ) {
      console.log(
        "[Content Script] Export button found via div[role=button]:",
        { text, ariaLabel }
      );
      return div as HTMLElement;
    }
  }

  // 3. 특정 스타일을 가진 요소 중에서 Export 텍스트 찾기
  const styledElements = document.querySelectorAll(
    '[style*="cursor: pointer"]'
  );
  console.log(
    `[Content Script] Found ${styledElements.length} elements with cursor: pointer`
  );

  for (const element of styledElements) {
    const text = element.textContent?.trim().toLowerCase() || "";
    if (text === "export" || text.includes("export")) {
      console.log("[Content Script] Export button found via style:", { text });
      return element as HTMLElement;
    }
  }

  // 4. Shadow DOM 확인
  const allElements = document.querySelectorAll("*");
  for (const element of allElements) {
    if (element.shadowRoot) {
      const shadowButtons = element.shadowRoot.querySelectorAll("button");
      for (const button of shadowButtons) {
        const text = button.textContent?.trim().toLowerCase() || "";
        if (text === "export" || text.includes("export")) {
          console.log("[Content Script] Export button found in shadow DOM");
          return button as HTMLElement;
        }
      }
    }
  }

  console.log("[Content Script] Export button not found");
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

    // Service Worker에 preview mode 활성화 메시지 전송
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ENABLE_PREVIEW_MODE",
      });

      if (response?.success) {
        console.log("[Content Script] Preview mode enabled");

        // button.textContent = "미리보기 모드 활성화 ✓";
        // button.style.background = "#0F7B6C";
        // button.style.color = "white";

        // // 2초 후 원래대로 복원
        // setTimeout(() => {
        //   button.textContent = "미리보기";
        //   button.style.background = "#2383E2";
        //   button.style.color = "white";
        // }, 2000);

        // Export 버튼을 자동으로 클릭 (선택사항)
        // 사용자가 명시적으로 Export를 클릭하도록 하려면 이 부분 제거
        const exportButton = findExportButton();
        if (exportButton) {
          // 약간의 지연 후 클릭
          setTimeout(() => {
            exportButton.click();
          }, 500);
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
 * Export 다이얼로그가 나타날 때 버튼 추가
 */
function observeDomChanges(): void {
  const observer = new MutationObserver(() => {
    // DOM에 변화가 있을 때마다 Export 버튼을 찾아 Preview 버튼 추가 시도
    tryAddPreviewButton();
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

// DOM이 준비되면 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
