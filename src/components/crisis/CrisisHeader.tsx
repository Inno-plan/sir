'use client';

import { ShieldAlert } from 'lucide-react';

export function CrisisHeader() {
  return (
    <div className="flex flex-col gap-3 bg-bg-dark px-5 py-5 lg:px-10 lg:py-8 rounded-xl">
      <div className="flex items-center gap-2.5">
        <ShieldAlert size={24} className="text-red-400" />
        <h1 className="text-xl lg:text-2xl font-bold text-white">위기 대응 센터</h1>
      </div>
      <p className="text-xs lg:text-sm font-medium text-slate-300">
        리스크 콘텐츠를 확인하고 신고 대행을 요청할 수 있습니다.
      </p>
    </div>
  );
}
