# KỸ NĂNG 1: ĐỌC ẢNH VIẾT TAY & CHUẨN HÓA KÝ HIỆU TOÁN HỌC
Mã kỹ năng: `skill-ocr-va-chuan-hoa-toan`
Phiên bản: 2.0 (Chuẩn GDPT 2018 THCS)

---

## 1. MỤC TIÊU & NHIỆM VỤ CHÍNH
Kỹ năng này chuyên trách tiếp nhận ảnh chụp trang vở bài tập viết tay của học sinh THCS (Lớp 6 đến Lớp 9), nhận diện chữ viết tay và các ký hiệu toán học đặc thù, sau đó chuyển đổi thành văn bản có cấu trúc rõ ràng:
1. `[Đề bài]`: Tách riêng đề bài hoặc yêu cầu bài toán từ đề in/đề chép.
2. `[Từng dòng bài làm của học sinh]`: Liệt kê chính xác từng bước biến đổi theo thứ tự dòng từ trên xuống dưới, đánh số thứ tự dòng (`Dòng 1`, `Dòng 2`, ...).

---

## 2. QUY TẮC XỬ LÝ & CHUẨN HÓA KÝ HIỆU TOÁN HỌC (LATEX)

Mọi công thức và ký hiệu toán học trong bài làm bắt buộc phải chuyển đổi sang cú pháp LaTeX chuẩn để KaTeX/MathJax render hoàn hảo:

### 2.1. Cú pháp phân định LaTeX
- Công thức nằm chung dòng văn bản: Đặt trong cặp dấu `$ ... $`. Ví dụ: `$x = 2$`, `$\\sqrt{x - 1} = 3$`.
- Công thức quan trọng hoặc khối công thức độc lập: Đặt trong cặp `$$ ... $$`. Ví dụ: `$$\\frac{a + b}{c} = 1$$`.

### 2.2. Chuẩn hóa các phép toán và biểu thức đại số
- **Phân số:** Dùng `\\frac{tử}{mẫu}` (hoặc `\\dfrac{tử}{mẫu}`). Tuyệt đối không dùng dấu gạch xiên `/` trong biểu thức toán phức tạp. Ví dụ: `\\frac{x^2 - 4}{x - 2}`.
- **Căn thức:** Dùng `\\sqrt{...}` hoặc `\\sqrt[n]{...}`. Lưu ý dấu căn phải bao trọn toàn bộ biểu thức dưới căn: `\\sqrt{3 - \\sqrt{5}}`.
- **Lũy thừa & Chỉ số dưới:** Dùng `a^{n}` và `x_{1}, x_{2}`. Có ngoặc nhọn `{}` khi số mũ/chỉ số có nhiều hơn 1 ký tự.
- **Giá trị tuyệt đối:** Dùng `|A|` hoặc `\\left| A \\right|`.
- **Hệ phương trình:** Dùng môi trường `\\begin{cases} ... \\end{cases}`:
  ```latex
  \\begin{cases} 2x + y = 5 \\\\ 3x - y = 5 \\end{cases}
  ```
- **Dấu tương đương & suy ra:** Chuẩn hóa thành `\\Leftrightarrow` ($\Leftrightarrow$) và `\\Rightarrow` ($\Rightarrow$).

### 2.3. Ký hiệu hình học THCS
- **Tam giác:** Dùng `\\triangle ABC` ($\triangle ABC$).
- **Góc:** Dùng `\\widehat{ABC}` ($\widehat{ABC}$) hoặc `\\angle A`.
- **Ký hiệu quan hệ hình học:**
  + Vuông góc: `\\perp` ($\perp$)
  + Song song: `\\parallel` ($\parallel$)
  + Đồng dạng: `\\sim` ($\sim$)
  + Bằng nhau / Trùng: `\\equiv` ($\equiv$) hoặc `=`
  + Độ lớn góc: `90^\\circ`, `45^\\circ`.

### 2.4. Quy ước chuẩn hóa số liệu Việt Nam
- **Dấu phẩy thập phân:** Bắt buộc dùng dấu phẩy bọc trong ngoặc nhọn `{,}` để tránh khoảng trắng LaTeX.
  + Ví dụ đúng: `0{,}5` ; `3{,}14` ; `12{,}75`.
  + Không dùng: `0.5` hoặc `0,5` (sẽ bị giãn cách xấu trong LaTeX).
- **Phân cách hàng nghìn:** Dùng dấu cách mỏng `\\,`.
  + Ví dụ đúng: `15\\,000` ; `1\\,250\\,000`.

---

## 3. PHÂN BIỆT NÉT GẠCH XÓA & NỘI DUNG CHÍNH THỨC
Học sinh THCS thường nháp, gạch xóa, viết đè lên vở:
1. **Phần gạch chéo / gạch ngang / bôi đen:** Bỏ qua hoàn toàn, KHÔNG đưa vào danh sách `[Từng dòng bài làm của học sinh]`.
2. **Phần viết lại bên cạnh hoặc phía dưới:** Nhận diện là nội dung chính thức được thay thế.
3. **Phần mũi tên chỉ vị trí chèn:** Tái tạo thứ tự đọc logic đúng theo ý đồ của học sinh.

---

## 4. NGUYÊN TẮC AN TOÀN DỮ LIỆU & XỬ LÝ ẢNH MỜ (DATA SAFETY FIRST)
- **CẤM ĐOÁN MÒ:** Tuyệt đối không được tự ý suy đoán số liệu nếu nét mực bị mờ, đứt đoạn, mất góc, lóa đèn flash, hoặc chữ viết tay quá mờ ám không thể phân biệt giữa các chữ số (ví dụ: số `0` với số `6`, số `1` với số `7`, dấu `+` với `-`).
- **XỬ LÝ KHI PHÁT HIỆN DỮ LIỆU KHÔNG RÕ:**
  Khi một số liệu cốt lõi trong đề bài hoặc bước làm quan trọng không đọc được, lập tức trả về trạng thái yêu cầu chụp lại:
  ```json
  {
    "status": "IMAGE_UNCLEAR",
    "unclear_region": "Dòng số 2 vế phải bị lóa sáng / số mũ bị mờ",
    "message": "Ảnh chụp ở vùng [vị trí] bị mờ/lóa sáng nên Thầy/Cô chưa đọc rõ số liệu. Em vui lòng chụp lại rõ nét hơn góc này để Thầy/Cô kiểm tra chính xác cho em nhé!"
  }
  ```
- Luôn ưu tiên độ chính xác 100% của số liệu trước khi chuyển giao sang Kỹ năng Phân tích Sư phạm.
