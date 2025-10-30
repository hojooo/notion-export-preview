/**
 * 확장 프로그램 타입 정의
 */

/**
 * 다운로드 가로채기 이벤트 정보
 */
export interface DownloadInterceptEvent {
  downloadId: number; // 다운로드 ID
  url: string;        // 다운로드 URL
  filename: string;   // 파일명
  timestamp: number;  // 타임스탬프
}

/**
 * PDF 뷰어 옵션
 */
export interface ViewerOptions {
  zoom: number;          // 줌 배율
  filename: string;      // 파일명
  originalUrl?: string;  // 원본 다운로드 URL (선택사항)
}
