import type { PipelineStage } from '@/types/pipeline';

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'crawling',
    label: '크롤링',
    buttonText: '크롤링 시작',
    result: {
      summary: '총 214개 컨텐츠 수집 완료',
      items: [
        '뉴스 42건 — 네이버 뉴스',
        '커뮤니티 68건 — 네이버증권 종목토론방, 팍스넷, 디시인사이드 주식갤러리, 뽐뿌 주식포럼',
        '포털 35건 — 네이버 검색결과',
        'SNS 69건 — 유튜브, 인스타그램, 네이버 카페, 네이버 블로그',
      ],
    },
  },
  {
    id: 'analysis',
    label: '분석',
    buttonText: '분석 시작',
    result: {
      summary: '감정 분석 완료 — SIR 지수 72점',
      items: [
        '긍정 65% — 실적 호조, 신제품 출시 반응',
        '중립 20% — 단순 언급, 정보 공유',
        '부정 15% — 리콜 이슈, 고객 불만',
      ],
    },
  },
  {
    id: 'content',
    label: '컨텐츠',
    buttonText: '컨텐츠 생성',
    result: {
      summary: '대응 컨텐츠 3건 생성 완료',
      items: [
        '보도자료 — "삼성전자, 2분기 실적 발표"',
        'FAQ — 제품 리콜 관련 고객 FAQ 10선',
        'SNS 포스트 — 긍정 이슈 확산 초안',
      ],
    },
  },
  {
    id: 'report',
    label: '리포트',
    buttonText: '리포트 생성',
    result: {
      summary: '주간 감사 리포트 생성 완료',
      items: [
        '총 214건 수집 / 감정 분석 완료',
        'SIR 지수: 72점 (전주 대비 +4점)',
        '주요 이슈: 리콜 관련 부정 여론 모니터링 필요',
        'PDF 리포트 첨부 준비 완료',
      ],
    },
  },
  {
    id: 'email',
    label: '이메일',
    buttonText: '리포트 발송',
    result: {
      summary: '리포트 발송 완료',
      items: [
        '수신: ir@samsung.com (IR팀)',
        '수신: pr@samsung.com (PR팀)',
        '수신: ceo-office@samsung.com (경영지원팀)',
      ],
    },
  },
];
