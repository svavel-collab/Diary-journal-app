'use strict';

const SUPABASE_URL = 'https://dlnetiryfhndmrbapgun.supabase.co';
const SUPABASE_ANON_KEY = 'Sb_publishable_kZw8bigzxzrXLHDWaQR-Qg_ewteBygi';

if (typeof supabase === 'undefined') {
    console.error('Supabase kunde inte laddas.');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = _supabase;
