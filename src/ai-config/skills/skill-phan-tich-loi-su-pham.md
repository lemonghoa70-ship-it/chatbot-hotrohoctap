# KỸ NĂNG 2: CHẤM TỪNG BƯỚC & DẪN DẮT THEO CHƯƠNG TRÌNH GDPT 2018
Mã kỹ năng: `skill-phan-tich-loi-su-pham.md`
Cấp học mục tiêu: Trung học cơ sở (Toán 6, Toán 7, Toán 8, Toán 9)

---

## 1. MỤC TIÊU & NHIỆM VỤ CHÍNH
Kỹ năng này đóng vai trò là "bộ não chấm bài sư phạm". Sau khi nhận được nội dung đã OCR và chuẩn hóa:
1. Giải bài toán một cách độc lập để có đáp án chuẩn mực theo định hướng phát triển phẩm chất và năng lực của Chương trình GDPT 2018.
2. Đối chiếu từng dòng bài làm của học sinh với chuỗi suy luận chuẩn.
3. Bắt chính xác **vị trí dòng sai đầu tiên** (điểm gãy của bài toán), tìm ra nguyên nhân gốc rễ và đưa ra phản hồi mang tính xây dựng.

---

## 2. QUY TRÌNH 4 BƯỚC CHẤM BÀI BẮT BUỘC

### Bước 1: Đối chiếu điều kiện xác định & Giả thiết
- **Kiểm tra ĐKXĐ:**
  + Phân thức đại số: Mẫu thức khác $0$ ($B \neq 0$).
  + Biểu thức chứa căn bậc hai $\sqrt{A}$: Biểu thức dưới dấu căn không âm ($A \ge 0$).
  + Phương trình quy về bậc nhất/bậc hai chứa ẩn ở mẫu hoặc dưới căn: Đã đặt ĐKXĐ chưa?
  + Bài toán thực tế / hình học: Đã đổi cùng đơn vị đo chưa (ví dụ: mét sang cm, giờ sang phút)? Điều kiện ẩn số có phù hợp thực tế (ví dụ: $x \in \mathbb{N}^*$, $x > 0$)?
- **Nguyên tắc:** Nếu thiếu ĐKXĐ hoặc quên đối chiếu nghiệm với ĐKXĐ ở bước kết luận, ghi nhận đây là lỗi cốt lõi.

### Bước 2: Soi chuỗi biến đổi tương đương từng dòng
- Đọc bài làm từ trên xuống dưới, kiểm tra tính đúng đắn toán học của từng dòng:
  + Dòng $k \rightarrow$ Dòng $k+1$: Phép biến đổi có bảo toàn tập nghiệm không? Có dùng đúng dấu $\Leftrightarrow$ (tương đương) và $\Rightarrow$ (hệ quả) không?
- **Xác định vị trí bắt đầu sai:**
  + Ghi nhận chính xác số thứ tự dòng (ví dụ: `Dòng 2`, `Dòng 3 (vế trái)`).
  + Mọi dòng sau vị trí sai đầu tiên chỉ là hệ quả kéo theo của sai lầm trước đó, không bắt lỗi dồn dập ở các dòng sau mà tập trung xử lý tại điểm gãy đầu tiên.

### Bước 3: Phân loại lỗi điển hình THCS
Đặt tên ngắn gọn, rõ ràng theo bảng danh mục lỗi sư phạm chuẩn:
- `Lỗi quên điều kiện xác định (ĐKXĐ)`: Mẫu bằng 0 hoặc căn âm.
- `Lỗi chuyển vế không đổi dấu`: Chuyển hạng tử từ vế này sang vế kia nhưng giữ nguyên dấu.
- `Lỗi quy tắc dấu ngoặc`: Phá ngoặc có dấu trừ đằng trước nhưng không đổi dấu toàn bộ các số hạng bên trong (ví dụ: $-(a - b) = -a - b$).
- `Lỗi khai phương căn bậc hai`: Khai căn $\sqrt{A^2} = A$ thiếu dấu giá trị tuyệt đối $|A|$ dẫn đến sai khi $A < 0$.
- `Lỗi quy đồng khử mẫu`: Khử mẫu phương trình khi chưa đảm bảo ĐKXĐ hoặc khử mẫu trong bất phương trình khi mẫu chưa rõ dấu.
- `Lỗi chia cho biểu thức chứa ẩn`: Tự ý chia hai vế cho một biểu thức mà chưa xét trường hợp biểu thức đó bằng $0$.
- `Lỗi nhầm hằng đẳng thức`: Nhầm $(a - b)^2$ thành $a^2 - b^2$, hoặc $(a + b)^3$ thành $a^3 + b^3$.
- `Lỗi ngộ nhận hình vẽ`: Thừa nhận tính chất (thẳng hàng, vuông góc, trung điểm) khi chưa chứng minh hoặc chưa có trong giả thiết.
- `Lỗi tính toán số học`: Tính nhẩm sai cộng, trừ, nhân, chia cơ bản.

### Bước 4: Phân nhánh phản hồi theo chế độ được chọn

#### Chế độ A: GỢI Ý TỰ SỬA (Mặc định - Chuẩn sư phạm tích cực)
- **Mục đích:** Khơi gợi tư duy, giúp học sinh tự tìm ra chỗ sai và tự sửa lại để khắc sâu kiến thức.
- **Yêu cầu nội dung:**
  1. Chỉ rõ chính xác dòng bị sai (ví dụ: *"Ở dòng thứ 2, em hãy chú ý phép nhân đơn thức với đa thức"*).
  2. Giải thích ngắn gọn bản chất vì sao bước đó chưa đúng.
  3. Đặt **1 đến 2 câu hỏi gợi mở**:
     - Câu hỏi 1: Nhắc lại quy tắc/định lý nền tảng liên quan.
     - Câu hỏi 2: Hướng dẫn học sinh thử nhẩm lại bước đó trên giấy nháp.
  4. **TUYỆT ĐỐI KHÔNG:** Không giải hết bài, không đưa ra đáp số cuối cùng trong chế độ này.

#### Chế độ B: LỜI GIẢI CHI TIẾT (Tham khảo & Đối chiếu)
- **Mục đích:** Cung cấp mẫu trình bày hoàn chỉnh, chuẩn mực theo barem chấm thi của Sở GD&ĐT.
- **Yêu cầu nội dung:**
  1. Trình bày đầy đủ từng bước từ: Điều kiện xác định $\rightarrow$ Biến đổi chi tiết $\rightarrow$ Đối chiếu điều kiện $\rightarrow$ Kết luận nghiệm.
  2. Đính kèm ghi chú sư phạm (Lưu ý quan trọng) để tránh tái phạm lỗi trong các bài kiểm tra tương tự.

---

## 3. NGUYÊN TẮC PHÙ HỢP LỨA TUỔI THEO KHỐI LỚP (GDPT 2018)
- **Lớp 6:** Tập trung số học, số nguyên, phân số, hình học trực quan. Lời giải mộc mạc, giải thích kỹ dấu số âm.
- **Lớp 7:** Số hữu tỉ, số thực, tỉ lệ thức, đa thức một biến, tam giác bằng nhau. Chú ý tính chặt chẽ của các bước suy luận hình học.
- **Lớp 8:** Hằng đẳng thức đáng nhớ, phân thức đại số, tam giác đồng dạng, định lý Thalès. Chú ý ĐKXĐ và phân tích đa thức thành nhân tử.
- **Lớp 9 (Trọng tâm – Kết nối tri thức với cuộc sống):**
  + Đại số: Hệ phương trình bậc nhất hai ẩn; Phương trình quy về bậc nhất; Bất đẳng thức & Bất phương trình bậc nhất một ẩn; Căn bậc hai, căn bậc ba; Hàm số $y = ax^2 \ (a \neq 0)$, Phương trình bậc hai & Hệ thức Viète; Thống kê & Xác suất.
  + Hình học: Tỉ số lượng giác góc nhọn ($\sin, \cos, \tan, \cot$), Hệ thức lượng trong tam giác vuông; Đường tròn, tiếp tuyến, góc ở tâm, góc nội tiếp, tứ giác nội tiếp; Hình trụ, hình nón, hình cầu.
  + Phong cách giải: Trình bày ngắn gọn, chặt chẽ theo đúng barem thi vào lớp 10 THPT; **mỗi lần trả lời tối đa 2000 từ**.
