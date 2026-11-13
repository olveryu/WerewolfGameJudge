/** Confirmed commands refresh only editorial reads and invalidate affected inventory snapshots. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

const logger = log.extend('AdminWordSubmissions');

/** Callers must consume one-time credentials inside run, never return them into the mutation cache. */
export function useSubmissionCommand<Input>(run: (input: Input) => Promise<void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'word-submissions'] }),
        client.invalidateQueries({ queryKey: ['admin', 'words'] }),
      ]);
    },
    onError: (cause) => handleError(cause, { label: '词语投稿操作', logger, feedback: false }),
  });
}
