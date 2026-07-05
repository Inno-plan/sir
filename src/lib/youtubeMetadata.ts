export interface YoutubeMetadataCarrier {
  platform_id?: string | null;
  title?: string | null;
  link?: string | null;
  metadata_purged_at?: string | null;
}

export const YOUTUBE_METADATA_EXPIRED_LABEL =
  'YouTube 메타데이터 만료 · 당시 분석 결과';

export const YOUTUBE_METADATA_EXPIRED_NOTICE =
  'YouTube 메타데이터는 정책에 따라 30일 후 만료되어 URL만 표시됩니다. 감정·리스크 분류는 보고서 생성 당시 수집 자료를 기반으로 한 과거 분석 결과입니다.';

export function isYoutubeMetadataPurged(item: YoutubeMetadataCarrier): boolean {
  return item.platform_id === 'youtube' && Boolean(item.metadata_purged_at);
}

export function getYoutubeDisplayTitle(item: YoutubeMetadataCarrier): string {
  if (isYoutubeMetadataPurged(item)) {
    return item.link || 'YouTube URL';
  }
  return item.title || item.link || '(제목 없음)';
}

export function getYoutubeMetadataNotice(item: YoutubeMetadataCarrier): string | null {
  return isYoutubeMetadataPurged(item) ? YOUTUBE_METADATA_EXPIRED_NOTICE : null;
}
