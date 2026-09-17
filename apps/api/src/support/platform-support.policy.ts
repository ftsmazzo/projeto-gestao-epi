import { SupportLifecycleStatus } from '@prisma/client';

type AssignmentInput = {
  lifecycleStatus: SupportLifecycleStatus;
  assignedToUserId: string | null;
  platformUserId: string;
};

export function canClaimSupportThread(input: AssignmentInput) {
  const isQueueState =
    input.lifecycleStatus === SupportLifecycleStatus.WAITING_HUMAN ||
    input.lifecycleStatus === SupportLifecycleStatus.IN_PROGRESS;
  const isAvailable =
    !input.assignedToUserId ||
    input.assignedToUserId === input.platformUserId;
  return isQueueState && isAvailable;
}

export function canReplySupportThread(input: AssignmentInput) {
  if (input.lifecycleStatus === SupportLifecycleStatus.RESOLVED) return false;
  return (
    !input.assignedToUserId ||
    input.assignedToUserId === input.platformUserId
  );
}
