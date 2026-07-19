export function isLegalPath(pathname: string): boolean {
  return pathname === '/legal' || pathname.startsWith('/legal/');
}
