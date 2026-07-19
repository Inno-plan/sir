import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type LegalDocument = 'terms' | 'privacy';

export async function getLegalContent(document: LegalDocument): Promise<string> {
  const filePath = path.join(process.cwd(), 'src', 'content', 'legal', `${document}.md`);
  return readFile(filePath, 'utf8');
}
