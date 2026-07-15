/** E2E Worker entrypoint; production routes with an E2E-only Durable Object composition. */

import worker from '../index';

export { WeChatAuthProxy } from '../durableObjects/WeChatAuthProxy';
export { GameRoom } from './GameRoom';

export default worker;
