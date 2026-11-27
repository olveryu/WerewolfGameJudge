/** A SQL predicate and the values its `?` placeholders bind, in order, composed into a caller's statement. */
export interface SqlCondition {
  readonly sql: string;
  readonly params: readonly (string | number)[];
}
