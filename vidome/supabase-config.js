// ====================================================================
// این فایل را با اطلاعات پروژه‌ی Supabase خودتان پر کنید.
// راهنمای کامل در فایل README.md موجود است.
// این مقادیر «مخفی» نیستند و در کد سمت کاربر دیده می‌شوند؛ امنیت واقعی
// توسط Row Level Security (فایل setup.sql) تأمین می‌شود، نه پنهان بودن این کلیدها.
// ====================================================================

const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL"; // مثال: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
