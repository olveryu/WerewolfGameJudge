-- Public room codes are reusable directory keys, not Durable Object identities.
-- This release intentionally invalidates rooms created by the previous routing model.

DELETE FROM room_participants;
DELETE FROM room_game_starts;
DELETE FROM rooms;
