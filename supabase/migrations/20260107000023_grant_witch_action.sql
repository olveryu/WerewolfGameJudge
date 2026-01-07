-- Grant execute permission for witch_action RPC
GRANT EXECUTE ON FUNCTION public.witch_action(TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
