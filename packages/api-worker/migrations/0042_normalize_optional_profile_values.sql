-- Store absent optional profile values as NULL, never as empty strings.

UPDATE users
SET
  avatar_url = NULLIF(avatar_url, ''),
  custom_avatar_url = NULLIF(custom_avatar_url, ''),
  avatar_frame = NULLIF(avatar_frame, ''),
  equipped_flair = NULLIF(equipped_flair, ''),
  equipped_name_style = NULLIF(equipped_name_style, ''),
  equipped_effect = NULLIF(equipped_effect, ''),
  equipped_seat_animation = NULLIF(equipped_seat_animation, '')
WHERE
  avatar_url = ''
  OR custom_avatar_url = ''
  OR avatar_frame = ''
  OR equipped_flair = ''
  OR equipped_name_style = ''
  OR equipped_effect = ''
  OR equipped_seat_animation = '';

CREATE TRIGGER users_optional_profile_values_insert
BEFORE INSERT ON users
WHEN
  NEW.avatar_url = ''
  OR NEW.custom_avatar_url = ''
  OR NEW.avatar_frame = ''
  OR NEW.equipped_flair = ''
  OR NEW.equipped_name_style = ''
  OR NEW.equipped_effect = ''
  OR NEW.equipped_seat_animation = ''
BEGIN
  SELECT RAISE(ABORT, 'optional profile values must be null or non-empty');
END;

CREATE TRIGGER users_optional_profile_values_update
BEFORE UPDATE OF
  avatar_url,
  custom_avatar_url,
  avatar_frame,
  equipped_flair,
  equipped_name_style,
  equipped_effect,
  equipped_seat_animation
ON users
WHEN
  NEW.avatar_url = ''
  OR NEW.custom_avatar_url = ''
  OR NEW.avatar_frame = ''
  OR NEW.equipped_flair = ''
  OR NEW.equipped_name_style = ''
  OR NEW.equipped_effect = ''
  OR NEW.equipped_seat_animation = ''
BEGIN
  SELECT RAISE(ABORT, 'optional profile values must be null or non-empty');
END;