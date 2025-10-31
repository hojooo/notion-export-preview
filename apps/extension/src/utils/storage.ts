/**
 * 확장 프로그램 설정 관리를 위한 Chrome Storage 유틸리티
 */

/**
 * 확장 프로그램 설정 인터페이스
 */
export interface ExtensionSettings {
  autoPreview: boolean; // 자동 미리보기 활성화 여부
  defaultZoom: number;  // 기본 줌 배율
}

/**
 * 기본 설정 값
 */
const DEFAULT_SETTINGS: ExtensionSettings = {
  autoPreview: true,
  defaultZoom: 1.0,
};

/**
 * chrome.storage.local에서 확장 프로그램 설정을 가져오는 함수
 * @returns 확장 프로그램 설정 객체
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return result as ExtensionSettings;
}

/**
 * chrome.storage.local에 확장 프로그램 설정을 저장하는 함수
 * @param settings 저장할 설정 (부분 업데이트 가능)
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

/**
 * 설정을 기본값으로 초기화하는 함수
 */
export async function resetSettings(): Promise<void> {
  await chrome.storage.local.set(DEFAULT_SETTINGS);
}


// 매번 모든 버튼을 찾는거 너무 비효율적