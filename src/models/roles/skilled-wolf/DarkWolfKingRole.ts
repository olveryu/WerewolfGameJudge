/**
 * Dark Wolf King Role Model
 * 
 * When killed by wolves (knife), the dark wolf king can shoot one player.
 * This is the wolf version of the hunter.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';

export class DarkWolfKingRole extends WolfBaseRole {
  readonly id = 'darkWolfKing';
  readonly displayName = '黑狼王';
  readonly description = '被刀杀时可以开枪带走一名玩家（狼人版猎人）';
  readonly hasNightAction = true;
  readonly actionOrder = 25; // Last in night phase
  readonly actionMessage = '请确认你的发动状态';
  readonly actionConfirmMessage = '确认';
}

export const darkWolfKingRole = new DarkWolfKingRole();
