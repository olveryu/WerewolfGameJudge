-- Drop use_witch_potion function (replaced by generic update_room_scalar)
-- Following "dumb database" principle - no business logic in RPC functions

DROP FUNCTION IF EXISTS public.use_witch_potion(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.use_witch_potion(TEXT, TEXT, INTEGER, INTEGER);
