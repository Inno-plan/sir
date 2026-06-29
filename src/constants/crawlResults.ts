import type { PlatformCrawlResult } from '@/types/pipeline';

// TODO: API 연동 후 제거
export const MOCK_CRAWL_RESULTS: PlatformCrawlResult[] = [
  {
    platformId: 'news',
    platformLabel: '뉴스',
    category: '뉴스',
    articles: [
      { title: '삼성전자, 2분기 영업이익 시장 기대치 상회', url: 'https://news.naver.com/article/001' },
      { title: '삼성전자 반도체 부문 회복세 뚜렷…HBM 수주 확대', url: 'https://news.naver.com/article/002' },
      { title: '삼성전자, 갤럭시 신제품 출시 앞두고 기대감 상승', url: 'https://news.naver.com/article/003' },
      { title: '삼성전자 주가 52주 신고가 경신…외국인 매수세', url: 'https://news.naver.com/article/004' },
      { title: '"삼성전자 목표가 상향" 증권사 리포트 잇따라', url: 'https://news.naver.com/article/005' },
    ],
  },
  {
    platformId: 'naver-stock-forum',
    platformLabel: '네이버증권 종목토론방',
    category: '커뮤니티',
    articles: [
      { title: '삼성전자 이번 실적 진짜 좋네요', url: 'https://finance.naver.com/item/board_read.nhn?code=005930&nid=1' },
      { title: 'HBM 관련 수혜 기대합니다', url: 'https://finance.naver.com/item/board_read.nhn?code=005930&nid=2' },
      { title: '외국인 매수세 지속 중 의견 공유', url: 'https://finance.naver.com/item/board_read.nhn?code=005930&nid=3' },
    ],
  },
  {
    platformId: 'paxnet',
    platformLabel: '팍스넷',
    category: '커뮤니티',
    articles: [
      { title: '삼성전자 반도체 사이클 바닥 확인?', url: 'https://paxnet.co.kr/stock/report/1' },
      { title: '삼전 차트 분석 — 돌파 시그널 감지', url: 'https://paxnet.co.kr/stock/report/2' },
    ],
  },
  {
    platformId: 'dcinside-stock',
    platformLabel: '디시인사이드 주식갤러리',
    category: '커뮤니티',
    articles: [
      { title: '삼성전자 실적 발표 요약 정리', url: 'https://gall.dcinside.com/board/view/?id=stock&no=1' },
      { title: '삼전 8만전자 가나요?', url: 'https://gall.dcinside.com/board/view/?id=stock&no=2' },
    ],
  },
  {
    platformId: 'ppomppu-stock',
    platformLabel: '뽐뿌 주식포럼',
    category: '커뮤니티',
    articles: [
      { title: '삼성전자 장기 보유 후기', url: 'https://ppomppu.co.kr/zboard/view.php?id=stock&no=1' },
      { title: '삼전 배당금 정리 (2026년 기준)', url: 'https://ppomppu.co.kr/zboard/view.php?id=stock&no=2' },
    ],
  },
  {
    platformId: 'naver',
    platformLabel: '네이버',
    category: '포털',
    articles: [
      { title: '삼성전자 실적 분석 — 2026년 상반기 전망', url: 'https://search.naver.com/search.nhn?query=samsung+1' },
      { title: '삼성전자 주가 전망 총정리', url: 'https://search.naver.com/search.nhn?query=samsung+2' },
    ],
  },
  {
    platformId: 'youtube',
    platformLabel: '유튜브',
    category: 'SNS',
    articles: [
      { title: '[긴급] 삼성전자 실적 발표 리뷰 — 반도체 슈퍼사이클 시작?', url: 'https://youtube.com/watch?v=abc1' },
      { title: '삼성전자 주가 전망 2026 하반기 분석', url: 'https://youtube.com/watch?v=abc2' },
      { title: '삼성 vs TSMC HBM 경쟁 구도 정리', url: 'https://youtube.com/watch?v=abc3' },
    ],
  },
  {
    platformId: 'instagram',
    platformLabel: '인스타그램',
    category: 'SNS',
    articles: [
      { title: '#삼성전자 #투자 — 실적 호조 반응 모음', url: 'https://instagram.com/p/samsung1' },
      { title: '#갤럭시S26 #삼성 — 신제품 기대 포스트', url: 'https://instagram.com/p/samsung2' },
    ],
  },
  {
    platformId: 'naver-cafe',
    platformLabel: '네이버 카페',
    category: 'SNS',
    articles: [
      { title: '삼성전자 주주모임 — 이번 분기 배당 예측', url: 'https://cafe.naver.com/samsung/1' },
      { title: '삼전 단기 매매 전략 공유합니다', url: 'https://cafe.naver.com/samsung/2' },
    ],
  },
  {
    platformId: 'naver-blog',
    platformLabel: '네이버 블로그',
    category: 'SNS',
    articles: [
      { title: '삼성전자 2026년 실적 분석 및 투자 포인트', url: 'https://blog.naver.com/samsung_analysis_1' },
      { title: '삼성전자 HBM 관련주 수혜 정리', url: 'https://blog.naver.com/samsung_analysis_2' },
      { title: '초보 투자자를 위한 삼성전자 기업 분석', url: 'https://blog.naver.com/samsung_analysis_3' },
    ],
  },
];
