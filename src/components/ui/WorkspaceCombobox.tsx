'use client';

import { useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import type { Workspace } from '@/types/workspace';

interface WorkspaceComboboxProps {
  workspaces: Workspace[];
  selectedId: string;
  onChange: (id: string) => void;
  includeAllOption?: boolean;
  allLabel?: string;
  placeholder?: string;
  className?: string;
}

export function WorkspaceCombobox({
  workspaces,
  selectedId,
  onChange,
  includeAllOption = true,
  allLabel = '전체 워크스페이스',
  placeholder = '워크스페이스 검색',
  className = 'w-full sm:w-56',
}: WorkspaceComboboxProps) {
  const [query, setQuery] = useState('');

  const allOption = { id: '', company_name: allLabel } as Workspace;
  const options = includeAllOption ? [allOption, ...workspaces] : workspaces;
  const filtered = query
    ? options.filter((ws) => ws.company_name.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = workspaces.find((ws) => ws.id === selectedId) ?? allOption;

  return (
    <Combobox
      value={selected}
      onChange={(ws) => onChange(ws?.id ?? '')}
      onClose={() => setQuery('')}
    >
      <div className={`relative ${className}`}>
        <div className="flex items-center rounded-lg border border-slate-200 bg-white transition-colors focus-within:border-blue-400">
          <ComboboxInput
            className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            displayValue={(ws: Workspace) => ws?.company_name ?? ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <ComboboxButton className="cursor-pointer bg-transparent px-2 text-slate-400">
            <ChevronDown size={16} />
          </ComboboxButton>
        </div>
        <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">검색 결과 없음</div>
          ) : (
            filtered.map((ws) => (
              <ComboboxOption
                key={ws.id || '_all'}
                value={ws}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors data-[focus]:bg-blue-50"
              >
                {({ selected: isSelected }) => (
                  <>
                    <Check
                      size={14}
                      className={isSelected ? 'text-blue-600' : 'text-transparent'}
                    />
                    <span className={isSelected ? 'font-semibold text-blue-600' : 'text-slate-700'}>
                      {ws.company_name}
                    </span>
                  </>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
