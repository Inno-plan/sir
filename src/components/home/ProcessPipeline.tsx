'use client';

import { useState } from 'react';
import {
  SearchCode,
  BrainCircuit,
  PenTool,
  FileBarChart,
  Mail,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PipelineStep {
  step: number;
  title: string;
  summary: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  details: string[];
  output: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    step: 1,
    title: '크롤링',
    summary: '뉴스·커뮤니티·SNS 등 8개 채널에서 기업 관련 콘텐츠를 실시간 수집합니다.',
    icon: SearchCode,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: '뉴스, 커뮤니티, SNS, 포털 등 8개 이상 채널에서 자동 수집',
    details: [
      '뉴스 — 네이버 뉴스',
      '커뮤니티 — 종목토론방, 팍스넷, 디시, 뽐뿌',
      '포털 — 네이버 검색결과',
      'SNS — 유튜브, 인스타, 카페, 블로그',
    ],
    output: '채널별 원문 데이터 + 메타정보 (작성일, 조회수, URL)',
  },
  {
    step: 2,
    title: '분석',
    summary: '수집된 콘텐츠의 감정을 AI가 분석하고 리스크 수준과 SIR 지수를 산출합니다.',
    icon: BrainCircuit,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    description: '수집된 콘텐츠를 AI가 감정 분석하고 리스크를 분류',
    details: [
      '감정 분류 — 긍정 / 중립 / 부정',
      'SIR 지수 산출 (0~1000)',
      '리스크 레벨 판정 — low ~ critical',
      '주의 콘텐츠 자동 플래깅',
    ],
    output: '감정 분석 결과 + SIR 지수 + 플래깅 목록',
  },
  {
    step: 3,
    title: '컨텐츠',
    summary: '분석 결과를 바탕으로 대응 콘텐츠를 생성하고 신고 대상을 선별합니다.',
    icon: PenTool,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: '분석 결과를 바탕으로 대응 콘텐츠 및 신고 대상 생성',
    details: [
      '대응 콘텐츠 — 보도자료, FAQ, SNS 포스트',
      '신고 대상 — 허위정보, 수위 위반 콘텐츠',
      '플래깅된 URL 기반 전략 자동 추천',
      '담당자 선택 후 실행',
    ],
    output: '대응 콘텐츠 초안 + 신고 대상 리스트',
  },
  {
    step: 4,
    title: '리포트',
    summary: '전 단계 결과를 종합하여 경영진용 주간 보고서를 생성합니다.',
    icon: FileBarChart,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: '크롤링·분석·컨텐츠 결과를 종합한 주간 보고서 자동 생성',
    details: [
      '수집 현황 요약 (채널별 건수)',
      'SIR 지수 및 전주 대비 변동',
      '주요 이슈 및 대응 현황',
      'PDF / DOCX 자동 생성',
    ],
    output: '경영진용 주간 감사 리포트 (PDF)',
  },
  {
    step: 5,
    title: '이메일',
    summary: '완성된 리포트를 클라이언트 담당자에게 발송합니다.',
    icon: Mail,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    description: '생성된 리포트를 클라이언트 담당자에게 자동 발송',
    details: [
      'IR팀, PR팀, 경영지원팀 등 수신자 관리',
      '리포트 PDF 첨부 자동 발송',
      '발송 이력 및 수신 확인 추적',
      '발송 스케줄 설정 가능',
    ],
    output: '리포트 발송 완료 + 발송 이력',
  },
];

export function ProcessPipeline() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {/* Pipeline flow — 모바일: 세로 나열, 데스크탑: 5열 + 화살표 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 lg:gap-0 lg:items-stretch">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === idx;

          return (
            <div key={step.step} className="contents">
              <button
                onClick={() => setActiveStep(isActive ? null : idx)}
                className={`rounded-2xl border-2 px-4 py-5 transition-all duration-200 cursor-pointer text-center flex flex-col items-center justify-start gap-2.5
                  ${isActive ? `${step.borderColor} ${step.bgColor} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
                `}
              >
                <div
                  className={`w-10 h-10 rounded-xl ${step.bgColor} flex items-center justify-center shrink-0`}
                >
                  <Icon size={20} className={step.color} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed">{step.summary}</p>
              </button>

              {/* Arrow connector — 데스크탑만 */}
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className="hidden lg:flex items-center justify-center px-1.5">
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile arrow hint */}
      {activeStep === null && (
        <p className="text-center text-xs text-slate-400 lg:hidden flex items-center justify-center gap-1">
          각 단계를 눌러 자세히 보기 <ChevronDown size={14} />
        </p>
      )}

      {/* Detail panel */}
      {activeStep !== null &&
        (() => {
          const current = PIPELINE_STEPS[activeStep];
          const Icon = current.icon;
          return (
            <div
              className={`rounded-2xl border-2 ${current.borderColor} ${current.bgColor} p-6 sm:p-8`}
            >
              <div className="flex items-start gap-4 mb-5">
                <div
                  className={`w-11 h-11 rounded-xl ${current.bgColor} border ${current.borderColor} flex items-center justify-center shrink-0`}
                >
                  <Icon size={22} className={current.color} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Step {current.step}. {current.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{current.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    주요 기능
                  </h4>
                  <ul className="space-y-2">
                    {current.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm text-slate-700">
                        <span
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full ${current.color.replace('text-', 'bg-')} shrink-0`}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    산출물
                  </h4>
                  <div className="bg-white/60 rounded-xl border border-white/80 p-4">
                    <p className="text-sm text-slate-700">{current.output}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
