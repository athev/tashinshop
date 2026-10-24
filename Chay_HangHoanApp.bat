@echo off
chcp 65001 >nul
title May Chu Theo Doi Hang Hoan Shopee - Khanh Phong
echo ============================================================
echo   UNG DUNG THEO DOI HANG HOAN & DOANH SO SHOPEE
echo ============================================================
echo.
echo   [1] Tren may tinh nay (Admin hoac Chu shop):
echo       http://localhost:3838/
echo.
echo   [2] Tren dien thoai (Chu shop ket noi cung wifi):
echo       Vao dia chi IP mang LAN hien o dong ben duoi
echo.
echo   * Co nut bam vao nhanh 1 cham:
echo       - Chu shop: PIN 5678
echo       - Admin:    PIN 1234
echo.
echo ============================================================
cd /d "%~dp0tools"
start "" http://localhost:3838/
node serve.js
pause
