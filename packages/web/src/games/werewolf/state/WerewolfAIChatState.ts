/** Client-only display contract for the Werewolf AI chat. */
export interface DisplayMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: number;
}
