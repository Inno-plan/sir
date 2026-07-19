'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckListIcon } from '@/components/icons/CheckListIcon';

interface MdProps {
  children: string;
  type?: 'reputation' | 'stratagy';
  className?: string;
}

const defaultComponents = (className: string) => ({
  h2: (props: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-bold text-slate-700 mt-4 mb-2 first:mt-0">{props.children}</h2>
  ),
  h3: (props: { children?: React.ReactNode }) => (
    <h3 className="text-xs font-bold text-slate-600 mt-3 mb-1.5">{props.children}</h3>
  ),
  h4: (props: { children?: React.ReactNode }) => (
    <h4 className="mt-3 mb-1.5 text-xs font-semibold text-slate-500">{props.children}</h4>
  ),
  p: (props: { children?: React.ReactNode }) => (
    <p className={`text-sm leading-relaxed mb-2 last:mb-0 ${className}`}>{props.children}</p>
  ),
  strong: (props: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-800">{props.children}</strong>
  ),
  a: (props: { children?: React.ReactNode; href?: string }) => (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-text-dark underline underline-offset-2"
    >
      {props.children}
    </a>
  ),
  ul: (props: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-1 text-sm ml-1">{props.children}</ul>
  ),
  ol: (props: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1 text-sm ml-1">{props.children}</ol>
  ),
  li: (props: { children?: React.ReactNode }) => (
    <li className={`leading-relaxed [&>p]:inline [&>p]:mb-0 ${className}`}>
      {props.children}
    </li>
  ),
  table: (props: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs w-full border-collapse">{props.children}</table>
    </div>
  ),
  thead: (props: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50">{props.children}</thead>
  ),
  th: (props: { children?: React.ReactNode }) => (
    <th className="text-left px-2 py-1.5 border-b border-slate-200 font-semibold text-slate-600">
      {props.children}
    </th>
  ),
  td: (props: { children?: React.ReactNode }) => (
    <td className="px-2 py-1.5 border-b border-slate-100 text-slate-600">{props.children}</td>
  ),
});

const reputationSectionComponents = {
  li: (props: { children?: React.ReactNode }) => (
    <li className="flex items-start gap-1.5 text-sm font-normal text-text-sub">
      <span className="shrink-0 mt-0.5">
        <CheckListIcon size={14} />
      </span>
      <span>{props.children}</span>
    </li>
  ),
  ul: (props: { children?: React.ReactNode }) => <ul className="space-y-1.5">{props.children}</ul>,
  ol: (props: { children?: React.ReactNode }) => <ol className="space-y-1.5">{props.children}</ol>,
  p: (props: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed text-text-sub mb-1.5 last:mb-0">{props.children}</p>
  ),
  strong: (props: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-text-dark">{props.children}</strong>
  ),
};

function splitByHeading(md: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  const parts = md.split(/^(#{2,3}\s+.+)$/m);

  let currentTitle = '';
  let currentBody = '';

  for (const part of parts) {
    if (/^#{2,3}\s+/.test(part)) {
      if (currentTitle || currentBody.trim()) {
        sections.push({ title: currentTitle, body: currentBody.trim() });
      }
      currentTitle = part.replace(/^#{2,3}\s+/, '');
      currentBody = '';
    } else {
      currentBody += part;
    }
  }
  if (currentTitle || currentBody.trim()) {
    sections.push({ title: currentTitle, body: currentBody.trim() });
  }

  return sections;
}

function ReputationMd({ children }: { children: string }) {
  const sections = splitByHeading(children);

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section, i) => (
        <div key={i} className="bg-bg-light rounded-lg px-5 py-4">
          {section.title && (
            <h3 className="text-sm font-semibold text-text-muted mb-2">{section.title}</h3>
          )}
          {section.body && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={reputationSectionComponents}>
              {section.body}
            </ReactMarkdown>
          )}
        </div>
      ))}
    </div>
  );
}

export function Md({ children, type = 'stratagy', className = '' }: MdProps) {
  if (type === 'reputation') {
    return <ReputationMd>{children}</ReputationMd>;
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={defaultComponents(className)}>
      {children}
    </ReactMarkdown>
  );
}
