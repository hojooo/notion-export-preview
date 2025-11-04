/**
 * Notion API 유틸리티
 */

const NOTION_API_BASE = "https://www.notion.so/api/v3";

/**
 * Export 작업 결과
 */
export interface ExportResult {
  exportURL: string;
  taskId: string;
}

/**
 * Notion 페이지 컨텍스트
 */
export interface NotionContext {
  pageId: string;
  spaceId: string;
  token: string;
}

/**
 * Export 작업 상태
 */
interface TaskStatus {
  state: "in_progress" | "success" | "failure";
  status?: {
    type: "complete";
    exportURL?: string;
  };
  error?: string;
}

/**
 * UUID v4 생성 (rootTaskId용)
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 쿠키에서 token_v2 추출
 * Content Script에서 호출됨
 */
export function getTokenV2FromCookie(cookieString: string): string | null {
  const value = `; ${cookieString}`;
  const parts = value.split(`; token_v2=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

/**
 * URL에서 Notion 페이지 ID 추출
 * 예: https://www.notion.so/Username-14d81f531dcb80b882e9c5716112c303
 *     → 14d81f53-1dcb-80b8-82e9-c5716112c303
 */
export function extractPageId(url: string): string | null {
  // UUID 형식: 32자리 hex (하이픈 없이)
  const match = url.match(/([a-f0-9]{32})/i);
  if (match) {
    const raw = match[1];
    // 하이픈 추가: 8-4-4-4-12 형식
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return null;
}

/**
 * 페이지 정보 조회 (spaceId 획득)
 * POST /api/v3/getRecordValues
 */
export async function getPageInfo(
  pageId: string,
  token: string
): Promise<{ spaceId: string }> {
  const response = await fetch(`${NOTION_API_BASE}/getRecordValues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token_v2=${token}`,
    },
    credentials: "include",
    body: JSON.stringify({
      requests: [
        {
          id: pageId,
          table: "block",
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`페이지 정보 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  const blockData = data.results?.[0]?.value;

  if (!blockData) {
    throw new Error("페이지를 찾을 수 없습니다");
  }

  const spaceId = blockData.space_id;
  if (!spaceId) {
    throw new Error("워크스페이스 ID를 찾을 수 없습니다");
  }

  return { spaceId };
}

/**
 * Export 작업 생성
 * POST /api/v3/enqueueTask
 *
 * @param params.pageId - 페이지 ID
 * @param params.spaceId - 워크스페이스 ID
 * @param params.scale - PDF 배율 (0.1 ~ 2.0, 기본값 1.0)
 * @param params.token - token_v2
 * @returns taskId
 */
export async function enqueueExport(params: {
  pageId: string;
  spaceId: string;
  scale: number;
  token: string;
}): Promise<string> {
  const { pageId, spaceId, scale, token } = params;

  // scale 범위 검증
  if (scale < 0.1 || scale > 2.0) {
    throw new Error(`잘못된 배율: ${scale} (0.1 ~ 2.0 사이여야 합니다)`);
  }

  const exportOptions: Record<string, unknown> = {
    exportType: "pdf",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
    pdfFormat: "A4",
    locale: "en",
    collectionViewExportType: "currentView",
    includeContents: "everything",
  };

  // scale이 1.0이 아닐 때만 포함
  if (scale !== 1.0) {
    exportOptions.scale = scale;
  }

  const requestBody = {
    task: {
      eventName: "partitionedExportBlock",
      request: {
        block: {
          id: pageId,
          spaceId: spaceId,
        },
        recursive: false,
        exportOptions,
        shouldExportComments: false,
        eventName: "partitionedExportBlock",
        rootTaskId: generateUUID(),
      },
      cellRouting: {
        spaceIds: [spaceId],
      },
    },
  };

  console.log("[notionPrivateApi] Export 작업 생성 중, 배율:", scale);

  const response = await fetch(`${NOTION_API_BASE}/enqueueTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token_v2=${token}`,
    },
    credentials: "include",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Export 작업 생성 실패: ${response.status}`);
  }

  const data = await response.json();
  const taskId = data.taskId;

  if (!taskId) {
    throw new Error("작업 ID가 반환되지 않았습니다");
  }

  console.log("[notionPrivateApi] 작업 생성 완료:", taskId);
  return taskId;
}

/**
 * Export 작업 상태 폴링
 * POST /api/v3/getTasks
 *
 * @param taskId - 작업 ID
 * @param token - token_v2
 * @param maxAttempts - 최대 시도 횟수 (기본 30회, 30초)
 * @returns exportURL
 */
export async function pollExportTask(
  taskId: string,
  token: string,
  maxAttempts: number = 30
): Promise<string> {
  console.log("[notionPrivateApi] 작업 상태 확인 중:", taskId);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${NOTION_API_BASE}/getTasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token_v2=${token}`,
      },
      credentials: "include",
      body: JSON.stringify({
        taskIds: [taskId],
      }),
    });

    if (!response.ok) {
      throw new Error(`작업 상태 조회 실패: ${response.status}`);
    }

    const data = await response.json();
    const taskStatus: TaskStatus = data.results?.[0];

    if (!taskStatus) {
      throw new Error("작업 상태를 찾을 수 없습니다");
    }

    // 성공
    if (taskStatus.state === "success" && taskStatus.status?.type === "complete") {
      const exportURL = taskStatus.status.exportURL;
      if (!exportURL) {
        throw new Error("완료된 작업에서 Export URL을 찾을 수 없습니다");
      }
      console.log("[notionPrivateApi] 작업 완료:", exportURL);
      return exportURL;
    }

    // 실패
    if (taskStatus.state === "failure") {
      throw new Error(`Export 실패: ${taskStatus.error || "알 수 없는 오류"}`);
    }

    // 진행 중 - 1초 대기 후 재시도
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Export 타임아웃 (${maxAttempts}초 초과)`);
}

/**
 * 전체 Export 프로세스 실행
 * 1. 페이지 정보 조회 (spaceId)
 * 2. Export 작업 생성
 * 3. 작업 완료 대기
 *
 * @param params.pageId - 페이지 ID
 * @param params.scale - PDF 배율 (슬라이더 값 / 100)
 * @param params.token - token_v2
 * @returns exportURL
 */
export async function exportPageWithScale(params: {
  pageId: string;
  scale: number;
  token: string;
}): Promise<string> {
  const { pageId, scale, token } = params;

  console.log("[notionPrivateApi] Export 프로세스 시작:", { pageId, scale });

  // 1. 페이지 정보 조회
  const { spaceId } = await getPageInfo(pageId, token);
  console.log("[notionPrivateApi] spaceId 조회 완료:", spaceId);

  // 2. Export 작업 생성
  const taskId = await enqueueExport({
    pageId,
    spaceId,
    scale,
    token,
  });

  // 3. 작업 완료 대기
  const exportURL = await pollExportTask(taskId, token);

  return exportURL;
}
