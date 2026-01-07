-- V2: Grant permissions for all RPC functions

GRANT EXECUTE ON FUNCTION atomic_field_update(TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
