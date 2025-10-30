/**
 * 인증이 필요한 다운로드를 위한 Fetch 유틸리티
 */

/**
 * 인증 정보(쿠키)를 포함하여 파일을 가져오는 함수
 * 비공개 Notion 페이지 접근 시 필수
 *
 * @param url 다운로드할 파일의 URL
 * @returns PDF 파일의 Blob 객체
 * @throws 다운로드 실패 시 에러
 */
export async function fetchWithCredentials(url: string): Promise<Blob> {
  const response = await fetch(url, {
    credentials: "include", // 인증을 위한 쿠키 포함
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Content-Type 확인
  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.includes("pdf")) {
    console.warn("[fetchWithCreds] Content-Type is not PDF:", contentType);
    // 일부 서버가 올바른 content-type을 설정하지 않을 수 있으므로 계속 진행
  }

  const blob = await response.blob();

  // 추가 검증: Blob이 실제로 데이터를 포함하는지 확인
  if (blob.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  return blob;
}
