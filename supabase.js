// Fill in your Supabase project URL and anon key
const SUPABASE_URL = 'https://nlecuoylopjaljqbvath.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWN1b3lsb3BqYWxqcWJ2YXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0OTEwMzEsImV4cCI6MjA4MjA2NzAzMX0.5ltIcOgPlBdFizcfZmmHnWMbxvQCmNu75O8SBW39RkQ';

// FIX: Variable is named 'supabase' to match other files
const supabase = window.supabase.createClient(
	SUPABASE_URL,
	SUPABASE_ANON_KEY
);