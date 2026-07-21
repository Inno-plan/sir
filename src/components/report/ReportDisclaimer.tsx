export function ReportDisclaimer() {
  return (
    <div className="pt-4 border-t border-border-light mt-4">
      <p className="text-[10px] lg:text-xs text-text-muted lg:text-center leading-relaxed whitespace-pre-line">
        {`SIR에서 제공하는 모든 데이터는 AI 알고리즘에 의해 가공된 참고용 자료로 정보의 완전성, 정확성, 적시성을 보증하지 않습니다.
실시간 여론의 특성상 정보의 일시적인 지연이나 기술적 오류가 발생할 수 있으며,
제공된 정보의 활용으로 인해 발생하는 직접적·간접적 손실에 대해 법적 책임을 지지 않습니다.
고객센터: 031. 926. 2211  ㅣ  ok@innoplan.kr`}
      </p>
      <div className="mt-3 flex items-center lg:justify-center gap-3 text-[10px] lg:text-xs text-text-muted">
        <a
          href="https://sir-private.notion.site/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text-dark hover:underline transition-colors"
        >
          개인정보처리방침
        </a>
        <span className="text-border-light">|</span>
        <a
          href="https://sir-term.notion.site/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text-dark hover:underline transition-colors"
        >
          이용약관
        </a>
      </div>
    </div>
  );
}
