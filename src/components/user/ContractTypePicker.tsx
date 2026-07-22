import { CONTRACT_TYPE_LABELS, type ContractType } from '@/types/subscription';

const OPTIONS: { value: ContractType; description: string }[] = [
  { value: 'trial', description: '시작일부터 10일' },
  { value: 'paid', description: '계약 기간 직접 설정' },
];

export function ContractTypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ContractType;
  onChange: (value: ContractType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={active}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'border-bg-accent bg-blue-50 text-text-accent'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            <span className="block text-sm font-semibold">
              {CONTRACT_TYPE_LABELS[option.value]}
            </span>
            <span className="mt-0.5 block text-[11px] opacity-70">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
