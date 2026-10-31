// Cấu hình Firebase cho tính năng ghé thăm nông trại bạn bè (coop).
// Dán cấu hình web app từ Firebase Console (Project settings → Your apps → SDK setup and configuration → Config).
// Để null thì game vẫn chơi bình thường, chỉ tắt phần bạn bè.
// Lưu ý: các khoá này không phải mật khẩu — an toàn nằm ở "Rules" của Realtime Database.
window.FIREBASE_CONFIG = null;
/* Ví dụ:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "ten-du-an.firebaseapp.com",
  databaseURL: "https://ten-du-an-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ten-du-an",
  storageBucket: "ten-du-an.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
*/
