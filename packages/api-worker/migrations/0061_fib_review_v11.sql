-- Review rubric v11: drop the read-aloud check; four hard gates (all must pass)
-- plus two fun signals (at least one must pass).
--
-- Historical review rows are immutable events validated under their own rubric,
-- so the decision/checks consistency CHECK only applies to v11 rows. A future
-- rubric version must extend this CHECK in its own migration.

CREATE TABLE fib_word_candidate_reviews_v11 (
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
    -- Whether most players are unlikely to know the fixed meaning before reveal.
    is_meaning_unfamiliar_to_most_players   INTEGER NOT NULL CHECK (
        is_meaning_unfamiliar_to_most_players IN (0, 1)
    ),
    -- Whether literal reading does not expose the fixed meaning.
    is_meaning_distinct_from_literal_reading INTEGER NOT NULL CHECK (
        is_meaning_distinct_from_literal_reading IN (0, 1)
    ),
    -- Whether players can invent at least one plausible wrong definition.
    has_multiple_plausible_wrong_definitions INTEGER NOT NULL CHECK (
        has_multiple_plausible_wrong_definitions IN (0, 1)
    ),
    -- Whether revealing the real meaning creates contrast or discussion value.
    has_reveal_value                        INTEGER NOT NULL CHECK (has_reveal_value IN (0, 1)),
    -- Decision derived from the quality checks under the v11 rubric.
    decision                                TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
    -- Human-readable evidence for the most important quality result.
    reason                                  TEXT NOT NULL CHECK (length(reason) > 0),
    -- Version of the review rubric that produced this event.
    review_version                          TEXT NOT NULL CHECK (length(review_version) > 0),
    -- Generation cycle containing the reviewed candidate.
    generation_cycle_id                     TEXT NOT NULL,
    -- UTC timestamp when the review completed.
    reviewed_at                             TEXT NOT NULL,
    -- Source snapshots supporting the reviewed meaning; NULL when unavailable.
    evidence_json                           TEXT CHECK (
        evidence_json IS NULL OR (json_valid(evidence_json) AND json_type(evidence_json) = 'array')
    ),
    -- Zero-based supporting source; NULL when none was cited.
    evidence_index                          INTEGER CHECK (evidence_index >= 0),
    -- Exact cited excerpt; NULL when evidence was unavailable.
    evidence_quote                          TEXT CHECK (length(evidence_quote) BETWEEN 8 AND 300),
    FOREIGN KEY (generation_cycle_id) REFERENCES fib_word_generation_cycles(id) ON DELETE RESTRICT,
    CHECK (
        review_version != '11'
        OR (
            (
                decision = 'accepted'
                AND is_established_term = 1
                AND is_definition_accurate = 1
                AND is_meaning_unfamiliar_to_most_players = 1
                AND is_meaning_distinct_from_literal_reading = 1
                AND (has_multiple_plausible_wrong_definitions = 1 OR has_reveal_value = 1)
            )
            OR (
                decision = 'rejected'
                AND NOT (
                    is_established_term = 1
                    AND is_definition_accurate = 1
                    AND is_meaning_unfamiliar_to_most_players = 1
                    AND is_meaning_distinct_from_literal_reading = 1
                    AND (has_multiple_plausible_wrong_definitions = 1 OR has_reveal_value = 1)
                )
            )
        )
    )
);

INSERT INTO fib_word_candidate_reviews_v11 (
    id, word, core_meaning, usage_note, category, source,
    is_established_term, is_definition_accurate,
    is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
    has_multiple_plausible_wrong_definitions, has_reveal_value,
    decision, reason, review_version, generation_cycle_id, reviewed_at,
    evidence_json, evidence_index, evidence_quote
)
SELECT
    id, word, core_meaning, usage_note, category, source,
    is_established_term, is_definition_accurate,
    is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
    has_multiple_plausible_wrong_definitions, has_reveal_value,
    decision, reason, review_version, generation_cycle_id, reviewed_at,
    evidence_json, evidence_index, evidence_quote
FROM fib_word_candidate_reviews;

DROP TABLE fib_word_candidate_reviews;

ALTER TABLE fib_word_candidate_reviews_v11 RENAME TO fib_word_candidate_reviews;

CREATE INDEX idx_fib_word_candidate_reviews_word_decision
    ON fib_word_candidate_reviews(word, decision);

CREATE INDEX idx_fib_word_candidate_reviews_cycle_decision
    ON fib_word_candidate_reviews(generation_cycle_id, decision);
