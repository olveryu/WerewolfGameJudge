/** Resolve a host management model's task card body for assertions. */

import {
  resolveHostTaskView,
  type RoomHostTaskBody,
} from '@/features/room/model/resolveHostTaskView';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';

export function hostTaskBody(model: RoomHostManagementModel | null): RoomHostTaskBody | null {
  if (model === null) return null;
  return resolveHostTaskView(model)?.body ?? null;
}
