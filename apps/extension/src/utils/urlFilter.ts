/**
 * Notion 내보내기 URL 식별을 위한 필터링 유틸리티
 */

/**
 * Notion 내보내기로 허용되는 호스트 패턴 목록
 * - notion.so: Notion 메인 도메인 (www, file 등 모든 서브도메인 포함)
 * - amazonaws.com: S3 저장소 도메인 (실제 PDF 파일 위치)
 */
const ALLOWED_PATTERNS = [
  /https:\/\/(.*\.)?notion\.so\//,  // file.notion.so, www.notion.so, notion.so 모두 매칭
  // /https:\/\/.*\.amazonaws\.com\//,
];

/**
 * 주어진 URL이 Notion 내보내기 다운로드인지 확인
 * @param url 검사할 URL
 * @returns Notion 내보내기면 true, 아니면 false
 */
export function isNotionExport(url: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * 허용된 호스트 패턴 목록을 반환
 * @returns 정규식 패턴 배열
 */
export function getAllowedPatterns(): RegExp[] {
  return ALLOWED_PATTERNS;
}
