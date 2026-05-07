-- Room participants tracking (for admin portal)
CREATE TABLE room_participants (
  room_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_code, user_id),
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_room_participants_room_code ON room_participants(room_code);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
