'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { AdminButton } from '@/components/ui/AdminButton';
import { Modal } from '@/components/ui/Modal';
import { CompanySearch } from '@/components/ui/CompanySearch';
import { ContractPeriodPicker } from '@/components/ui/ContractPeriodPicker';
import { TierPicker } from '@/components/user/TierPicker';
import { ContractTypePicker } from '@/components/user/ContractTypePicker';
import { useCreateUser } from '@/hooks/user/useUserMutation';
import { type ContractType, type Tier } from '@/types/subscription';
import type { ProfileRole } from '@/types/auth';
import { getErrorMessage } from '@/lib/utils';
import {
  getContractPresetEndDate,
  getKstTodayDate,
  getTrialEndDate,
  TRIAL_DURATION_DAYS,
  toContractEndIso,
  toContractStartIso,
} from '@/lib/contractDate';
import {
  checkPassword,
  PASSWORD_PLACEHOLDER,
  STRENGTH_LABEL,
  type PasswordStrength,
} from '@/lib/auth/passwordPolicy';

const STRENGTH_BAR_STYLE: Record<PasswordStrength, { fill: string; bars: number; text: string }> = {
  weak: { fill: 'bg-red-400', bars: 1, text: 'text-red-500' },
  medium: { fill: 'bg-amber-400', bars: 2, text: 'text-amber-600' },
  strong: { fill: 'bg-green-500', bars: 3, text: 'text-green-600' },
};

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  myRole: ProfileRole;
}

export function CreateUserModal({ open, onClose, myRole }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ProfileRole>('user');

  // role='user' 전용
  const [selectedCompany, setSelectedCompany] = useState<{ name: string; ticker: string } | null>(
    null
  );
  const [industry, setIndustry] = useState('');
  const [businessSummary, setBusinessSummary] = useState('');
  const [tier, setTier] = useState<Tier>('black_plus');
  const [contractType, setContractType] = useState<ContractType>('paid');
  const [startDate, setStartDate] = useState<Date | undefined>(() => getKstTodayDate());
  const [endDate, setEndDate] = useState<Date | undefined>(() =>
    getContractPresetEndDate(getKstTodayDate(), 1)
  );

  // admin/super_admin 전용
  const [companyNameAdmin, setCompanyNameAdmin] = useState('');

  const createUserMutation = useCreateUser();
  const isSuperAdmin = myRole === 'super_admin';

  const pwCheck = checkPassword(password);
  const strengthStyle = STRENGTH_BAR_STYLE[pwCheck.strength];

  const canSubmit =
    email.length > 0 &&
    pwCheck.ok &&
    (role === 'user'
      ? selectedCompany !== null && startDate !== undefined && endDate !== undefined && endDate >= startDate
      : companyNameAdmin.trim().length > 0);

  const reset = () => {
    setEmail('');
    setPassword('');
    setRole('user');
    setSelectedCompany(null);
    setIndustry('');
    setBusinessSummary('');
    setTier('black_plus');
    setContractType('paid');
    const today = getKstTodayDate();
    setStartDate(today);
    setEndDate(getContractPresetEndDate(today, 1));
    setCompanyNameAdmin('');
  };

  const handlePeriodChange = ({ start, end }: { start: Date | undefined; end: Date | undefined }) => {
    setStartDate(start);
    setEndDate(contractType === 'trial' && start ? getTrialEndDate(start) : end);
  };

  const handleContractTypeChange = (next: ContractType) => {
    setContractType(next);
    if (next === 'trial') {
      const trialStart = startDate ?? getKstTodayDate();
      setStartDate(trialStart);
      setEndDate(getTrialEndDate(trialStart));
    }
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    try {
      const payload =
        role === 'user' && selectedCompany && startDate && endDate
          ? {
              email,
              password,
              role: 'user' as ProfileRole,
              company_name: selectedCompany.name,
              ticker: selectedCompany.ticker,
              industry: industry.trim() || undefined,
              business_summary: businessSummary.trim() || undefined,
              tier,
              contract_type: contractType,
              subscription_start: toContractStartIso(startDate),
              subscription_end: toContractEndIso(endDate),
            }
          : {
              email,
              password,
              role,
              company_name: companyNameAdmin.trim(),
            };
      await createUserMutation.mutateAsync(payload);
      toast.success('계정이 생성되었습니다.');
      reset();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, '계정 생성에 실패했습니다.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 계정 생성"
      size="md"
      footer={
        <AdminButton
          variant="primary"
          onClick={handleCreate}
          disabled={createUserMutation.isPending || !canSubmit}
          fullWidth
        >
          {createUserMutation.isPending ? '생성 중...' : '계정 생성'}
        </AdminButton>
      }
    >
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-600 mb-1 block">
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            name="sir_new_account_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="name@company.com"
            autoComplete="off"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600 mb-1 block">
            비밀번호 <span className="text-red-500">*</span>
          </label>
          <input
            name="sir_new_account_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder={PASSWORD_PLACEHOLDER}
            autoComplete="new-password"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400"
          />
          {password.length > 0 && (
            <>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strengthStyle.bars ? strengthStyle.fill : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs font-medium ${strengthStyle.text}`}>
                  {STRENGTH_LABEL[pwCheck.strength]}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {pwCheck.rules.map((rule) => (
                  <li key={rule.key} className="flex items-center gap-1.5 text-xs">
                    {rule.passed ? (
                      <Check size={12} className="text-green-500 shrink-0" />
                    ) : (
                      <X size={12} className="text-slate-300 shrink-0" />
                    )}
                    <span className={rule.passed ? 'text-green-600' : 'text-slate-400'}>
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {isSuperAdmin && (
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">권한</label>
            <div className="flex gap-2">
              {(['user', 'admin', 'super_admin'] as ProfileRole[]).map((r) => (
                <AdminButton
                  key={r}
                  variant={role === r ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setRole(r)}
                >
                  {r === 'user' ? '사용자' : r === 'admin' ? '관리자' : '최고관리자'}
                </AdminButton>
              ))}
            </div>
          </div>
        )}

        {role === 'user' ? (
          <>
            <CompanySearch onChange={setSelectedCompany} />

            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">
                서비스 티어 <span className="text-red-500">*</span>
              </label>
              <TierPicker value={tier} onChange={setTier} />
              <p className="mt-2 text-xs text-slate-500">
                계정 생성 시 최초 보고서가 자동 생성됩니다. 관리자 검토 후 분석 시작 버튼으로 발행하세요.
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">
                계약 유형 <span className="text-red-500">*</span>
              </label>
              <ContractTypePicker value={contractType} onChange={handleContractTypeChange} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">
                계약 기간 <span className="text-red-500">*</span>
              </label>
              <ContractPeriodPicker
                startDate={startDate}
                endDate={endDate}
                onChange={handlePeriodChange}
                placeholder="시작일 ~ 종료일"
                fixedDurationDays={contractType === 'trial' ? TRIAL_DURATION_DAYS : undefined}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">업종</label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="예: 게임, 반도체, 바이오"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1 block">사업 개요</label>
              <textarea
                value={businessSummary}
                onChange={(e) => setBusinessSummary(e.target.value)}
                rows={3}
                placeholder="주요 사업 내용, 매출 구조, 자회사 등"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400 resize-none"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-sm font-semibold text-slate-600 mb-1 block">
              회사명 <span className="text-red-500">*</span>
            </label>
            <input
              name="sir_new_account_company_name"
              value={companyNameAdmin}
              onChange={(e) => setCompanyNameAdmin(e.target.value)}
              placeholder="(주)이노다이브"
              autoComplete="off"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-slate-400"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
