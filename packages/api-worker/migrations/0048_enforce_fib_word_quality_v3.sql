-- Reset disposable FibKing inventory so review v3 starts from a clean, auditable baseline.

DELETE FROM fib_word_usages;
DELETE FROM fib_round_word_selections;
DELETE FROM fib_word_exposures;
DELETE FROM fib_words;
DROP TABLE fib_word_candidate_reviews;

UPDATE fib_word_supply_state
SET active_cycle_id = NULL,
    active_cycle_started_at = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    last_completed_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 1;

DELETE FROM fib_word_generation_cycles;

CREATE TABLE fib_word_candidate_reviews (
    -- Stable identity for one immutable review event.
    id                                      TEXT PRIMARY KEY,
    -- Candidate text reviewed in this event.
    word                                    TEXT NOT NULL,
    -- Candidate meaning snapshot presented to the reviewer.
    core_meaning                            TEXT NOT NULL,
    -- Candidate usage-note snapshot presented to the reviewer.
    usage_note                              TEXT NOT NULL,
    -- Requested generation category at review time.
    category                                TEXT NOT NULL CHECK (
        category IN ('literary', 'internet', 'compound', 'niche')
    ),
    -- Provider that produced the reviewed candidate.
    source                                  TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
    -- Whether the candidate is a real term with an established meaning.
    is_established_term                     INTEGER NOT NULL CHECK (is_established_term IN (0, 1)),
    -- Whether the supplied definition is factually accurate.
    is_definition_accurate                  INTEGER NOT NULL CHECK (is_definition_accurate IN (0, 1)),
    -- Whether ordinary players can naturally read the term aloud.
    is_easy_to_read_aloud                   INTEGER NOT NULL CHECK (is_easy_to_read_aloud IN (0, 1)),
    -- Whether most players are unlikely to know the fixed meaning before reveal.
    is_meaning_unfamiliar_to_most_players   INTEGER NOT NULL CHECK (
        is_meaning_unfamiliar_to_most_players IN (0, 1)
    ),
    -- Whether literal reading does not expose the fixed meaning.
    is_meaning_distinct_from_literal_reading INTEGER NOT NULL CHECK (
        is_meaning_distinct_from_literal_reading IN (0, 1)
    ),
    -- Whether players can invent multiple plausible wrong definitions.
    has_multiple_plausible_wrong_definitions INTEGER NOT NULL CHECK (
        has_multiple_plausible_wrong_definitions IN (0, 1)
    ),
    -- Whether revealing the real meaning creates contrast or discussion value.
    has_reveal_value                        INTEGER NOT NULL CHECK (has_reveal_value IN (0, 1)),
    -- Decision derived from the seven quality checks.
    decision                                TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
    -- Human-readable evidence for the most important quality result.
    reason                                  TEXT NOT NULL CHECK (length(reason) > 0),
    -- Version of the review rubric that produced this event.
    review_version                          TEXT NOT NULL CHECK (length(review_version) > 0),
    -- Generation cycle containing the reviewed candidate.
    generation_cycle_id                     TEXT NOT NULL,
    -- UTC timestamp when the review completed.
    reviewed_at                             TEXT NOT NULL,
    FOREIGN KEY (generation_cycle_id) REFERENCES fib_word_generation_cycles(id) ON DELETE RESTRICT,
    CHECK (
        (
            decision = 'accepted'
            AND is_established_term = 1
            AND is_definition_accurate = 1
            AND is_easy_to_read_aloud = 1
            AND is_meaning_unfamiliar_to_most_players = 1
            AND is_meaning_distinct_from_literal_reading = 1
            AND has_multiple_plausible_wrong_definitions = 1
            AND has_reveal_value = 1
        )
        OR (
            decision = 'rejected'
            AND (
                is_established_term = 0
                OR is_definition_accurate = 0
                OR is_easy_to_read_aloud = 0
                OR is_meaning_unfamiliar_to_most_players = 0
                OR is_meaning_distinct_from_literal_reading = 0
                OR has_multiple_plausible_wrong_definitions = 0
                OR has_reveal_value = 0
            )
        )
    )
);

CREATE INDEX idx_fib_word_candidate_reviews_word_decision
    ON fib_word_candidate_reviews(word, decision);

CREATE INDEX idx_fib_word_candidate_reviews_cycle_decision
    ON fib_word_candidate_reviews(generation_cycle_id, decision);