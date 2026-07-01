export const supportKeys = {
  all: ['support'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  list: (workspaceId?: string) =>
    [...supportKeys.lists(), workspaceId && workspaceId.length > 0 ? workspaceId : 'all'] as const,
};
