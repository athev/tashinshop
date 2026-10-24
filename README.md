# Hệ Thống Theo Dõi Hàng Hoàn & Doanh Số Shopee · Khánh Phong

Ứng dụng web quản lý đơn hoàn, khiếu nại, đối soát kho và thống kê doanh số bán hàng Shopee cho cửa hàng Khánh Phong.

## Tính năng chính
- **Dashboard Thống kê & Doanh số**: Phân tích doanh số theo thời gian, tỷ lệ đơn thành công, hoàn trả, hủy đơn.
- **Theo dõi Hàng hoàn Step-by-Step**:
  - Giao diện trực quan cho Admin và Chủ shop.
  - Tự động phân loại đơn: Đang hoàn về, Hàng đã về kho, Chờ khiếu nại, Quá hạn xử lý.
  - Tự động đóng và loại bỏ các đơn khiếu nại mà người mua đã tự hủy.
- **Phân quyền người dùng**:
  - **Admin**: Nhập dữ liệu báo cáo Shopee, quản lý chung, thiết lập cấu hình.
  - **Chủ shop**: Kiểm tra hàng thực tế về kho, chụp ảnh tình trạng hàng, khiếu nại Shopee.
- **Hỗ trợ mạng nội bộ (LAN)**: Chủ shop và nhân viên kho có thể truy cập qua điện thoại hoặc máy tính khác trong cùng mạng Wi-Fi.

## Cài đặt & Khởi chạy

### Yêu cầu
- [Node.js](https://nodejs.org/) (phiên bản 16 trở lên)

### Khởi chạy nhanh (Windows)
Chạy file batch:
```bat
Chay_HangHoanApp.bat
```
Hoặc chạy lệnh thủ công:
```bash
cd tools
npm start
```
Ứng dụng sẽ mở tại địa chỉ: `http://localhost:3838/`
Mạng LAN: hiển thị địa chỉ IP tương ứng (ví dụ: `http://192.168.x.x:3838/`)

## Cấu trúc thư mục
- `HangHoanApp/`: Giao diện ứng dụng web frontend (HTML, CSS, JavaScript).
- `tools/`: Server backend Node.js (`serve.js`), công cụ phân tích dữ liệu Shopee.
- `HangHoanData/`: Thư mục lưu trữ cấu hình và trạng thái đơn hàng.
- `Guideline/`: Tài liệu hướng dẫn quy trình vận hành và kiểm tra hàng hoàn.
