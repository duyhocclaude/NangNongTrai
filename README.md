# 🌿 Nàng Nông Trại

Game nông trại 2D chạy trên trình duyệt (HTML5 Canvas + JavaScript thuần, không cần cài đặt).
Trồng cây, chăn nuôi, nhận đơn hàng từ đối tác và mở rộng nông trại của bạn!

## ▶ Chơi ngay

- **Online:** mở link GitHub Pages của repo (mục *About* → website).
- **Trên máy:** tải repo về rồi mở file `index.html` bằng Chrome / Edge.

Chơi được trên máy tính và điện thoại (xoay ngang màn hình).

## 🎮 Tính năng

- Đặt tên nhân vật (đổi lại được), hoạt ảnh đi 4 hướng, gieo hạt, tưới cây.
- Thời gian nhanh hơn thực tế: **10 phút = 1 ngày làm việc (7:00 – 18:00)**.
- 10 loại cây (lúa mì, cải xanh, cà rốt, dưa chuột, ngô, cà chua, bí ngô, dâu tây, hoa hồng, dưa hấu) mở khoá theo cấp.
- Chăn nuôi gà, vịt, dê, bò sữa, cừu — gà ăn lúa mì tự trồng.
- Phân bón x2 / x3 / x5 giúp cây lớn nhanh.
- Nước tính theo m³, nạp lại có phí (thêm phí bơm gấp khi để bể cạn).
- Đơn hàng từ đối tác: nhận / từ chối, có hạn giao, **hoá đơn VAT 15%**, giao trễ bị trừ tiền.
- Mua thêm ô đất để mở rộng nông trại.
- Câu cá ở ao: 9 loài giá khác nhau (cá rô 1.500đ … cá thần tài 90.000đ), cần câu tre / carbon, mồi câu, 15 lượt mỗi ngày.
- Tiền tệ: Việt Nam đồng. Âm thanh tự tổng hợp: nhạc nền, gà gáy, chim hót, nước chảy...
- Zoom vào nhân vật, bảng đơn hàng kéo thả / phóng to thu nhỏ.

## ⌨️ Điều khiển

| Thao tác | Máy tính | Điện thoại |
|---|---|---|
| Di chuyển | Bấm lên mặt đất / W A S D | Chạm lên mặt đất |
| Làm việc với ô đất, chuồng | Bấm vào ô / chuồng | Chạm |
| Đổi công cụ | Phím 1 – 5 | Thanh công cụ góc phải dưới |
| Zoom | Lăn chuột / phím + − 0 | Chụm 2 ngón tay |

Tiến trình được lưu tự động trong trình duyệt (localStorage).

## 📁 Cấu trúc

```
index.html          giao diện
style.css           kiểu dáng
game.js             toàn bộ logic game
assets/             ảnh nhân vật & sprite sheet hoạt ảnh (ô 128×128)
```

Các thông số cân bằng (giá, thời gian, nước, phân bón...) nằm ở đầu `game.js` (`CROPS`, `ANIMALS`, `FERTS`, `WATER`).

## 👥 Ghé thăm nông trại bạn bè (coop)

Mỗi người chơi có một **mã nông trại 6 ký tự** (nút 👥 Bạn bè). Nhập mã của bạn bè để sang nông trại của họ:
thấy nhau đi lại theo thời gian thực, **tưới giúp** ô đang khát nước (dùng nước của mình, +1 XP) và **tặng quà** từ kho
(bạn bè offline thì quà chờ đến khi họ vào game). Không thể gieo hạt hay thu hoạch ở nông trại người khác.

Tính năng này cần một dự án [Supabase](https://supabase.com) miễn phí:

1. Vào <https://supabase.com/dashboard> → **Sign in with GitHub** → **New project** (vùng *Southeast Asia (Singapore)*, đặt mật khẩu database bất kỳ).
2. **Authentication → Sign In / Providers** (hoặc *Auth settings*) → bật **Allow anonymous sign-ins** → Save.
3. **SQL Editor → New query** → dán toàn bộ file [`supabase-setup.sql`](supabase-setup.sql) → **Run**.
4. **Project Settings → API** (hoặc nút **Connect**) → chép **Project URL** và khoá **anon / publishable**.
5. Điền 2 giá trị đó vào [`supabase-config.js`](supabase-config.js) (thay `null`).

Dự án Supabase miễn phí sẽ tạm dừng nếu 7 ngày không ai chơi; vào Dashboard bấm **Restore** để bật lại.
