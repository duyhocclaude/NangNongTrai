// Cấu hình Supabase cho tính năng ghé thăm nông trại bạn bè (coop).
// Lấy ở Supabase Dashboard → Project Settings → API (hoặc nút "Connect"):
//   url     = Project URL
//   anonKey = khoá "anon" / "publishable" (KHÔNG dùng khoá service_role / secret)
// Để null thì game vẫn chơi bình thường, chỉ tắt phần bạn bè.
// Khoá anon được phép công khai — dữ liệu được bảo vệ bằng Row Level Security trong supabase-setup.sql.
window.SUPABASE_CONFIG = null;
/* Ví dụ:
window.SUPABASE_CONFIG = {
  url: "https://abcdefghijklmnop.supabase.co",
  anonKey: "eyJhbGciOi..."
};
*/
