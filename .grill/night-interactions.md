# Grill: night interactions

Date: 2026-11-20

## Intent

Unify room actions and private disclosures while showing public outcomes automatically.

## Key decisions

- Fixed-size night selections open confirmation when the required seats are selected; cancellation leaves selection active and clears fixed pairs.
- Variable-size hypnosis uses an explicit confirmation entry; cancellation clears the selection.
- Identity cards and specified private statuses ask before disclosure. The final acknowledgement records the first view or satisfies the progression gate.
- Group statuses require every eligible player's acknowledgement. Cancelling disclosure does not acknowledge.
- Avalon Lady of the Lake reveals the result to the holder immediately after target confirmation; the holder acknowledges before transfer and progression.
- Voting cards submit directly; Avalon quest cards and Secret Hitler policy cards require confirmation. A cancellation is not a skip or withdrawal.
- Seed Wolf can infect only the settled wolf attack target. Opening infection directly asks whether to activate it on that seat; cancellation does not submit. A separate skip action requires confirmation and can be used without viewing the target.
- With no eligible infection target, retain a locked infection card with a generic explanation; confirm the separate skip action to advance.
- Secret Hitler night recognition and policy preview ask before disclosure. Information acknowledgements use "知道了"; action buttons keep their action-specific labels.
- Secret Hitler investigation, special election, execution, and chancellor nomination use seat selection followed by confirmation. Investigation privately reveals only faction, advances after acknowledgement, and has no in-game result replay; the end-game review retains the record.
- Secret Hitler veto requests and responses require confirmation. Legislative hands automatically open for the acting player and cannot be closed before the policy action or veto request; policy selection requires confirmation. When veto is rejected, the Chancellor's hand opens again.
- Avalon quest cards also require confirmation; quest and Secret Hitler policy panels cannot be dismissed before the required action. Avalon quest keeps its five-second post-submission reveal countdown.
- Avalon, Secret Hitler, and Werewolf sheriff ballots remain editable through the existing five-second countdown after all eligible voters submit. After reveal, the room displays the public result for a separate five seconds, then advances automatically. No one confirms or dismisses the result, including bots.
- The result timer is authoritative and continues while players are offline; reconnecting during the display shows the remaining time. Previously settled results remain available in the game record.
- Avalon vote and quest results and Secret Hitler vote, policy, and veto results use the automatic display. A veto or rejected vote that triggers chaos combines the trigger and enacted policy in one result panel and one countdown.
- The Werewolf sheriff election displays each vote round with each candidate's tally and voters, abstentions, and the outcome. It also displays a result for elections ending without a ballot, including no candidates, a sole candidate, and self-destruction. An interrupted ballot stays private.
- A decisive result is shown for the full five seconds before the end screen or subsequent phase.
- Public results take precedence over other open panels; after the result closes, preserve and restore the previous panel and unsubmitted content.
- Mandatory legislative hands must be resolved before leaving or switching seats; the earlier proposed switching exception was rejected.
- Remove the in-game Lady of the Lake result replay action. The holder sees the private faction immediately after confirming the target and must acknowledge it before transferring the token; an unacknowledged result survives reconnection. Public checked-player history and the end-game review remain available.
- If Hitler is elected Chancellor after three Fascist policies, first show the passed government vote for five seconds; then reveal the victory on the end screen, without entering legislation.

## Out of scope

- Daytime, elimination, and passive werewolf abilities are outside the Night-1 matrix.
