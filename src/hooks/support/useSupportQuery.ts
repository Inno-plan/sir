import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupportInquiries } from '@/lib/api/supportApi';
import { createClient } from '@/lib/supabase/client';
import { supportKeys } from './supportKeys';

export function useSupportInquiries(workspaceId?: string) {
  return useQuery({
    queryKey: supportKeys.list(workspaceId),
    queryFn: () => getSupportInquiries({ workspaceId }),
  });
}

export function useSupportInquiriesRealtime(workspaceId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channelName = `support-inquiries-${workspaceId || 'all'}`;
    const filter = workspaceId ? `workspace_id=eq.${workspaceId}` : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_inquiries',
          ...(filter ? { filter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);
}
