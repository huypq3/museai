#!/usr/bin/env python3
"""
Script tạo PDF test về Tượng Trần Hưng Đạo để test RAG pipeline.
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import sys

def create_test_pdf(output_path):
    """Tạo PDF test với nội dung về Trần Hưng Đạo."""
    
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # Content về Trần Hưng Đạo
    content = """
TƯỢNG TRẦN HƯNG ĐẠO - TÀI LIỆU BẢO TÀNG

I. THÔNG TIN CƠ BẢN

Tên hiện vật: Tượng đồng Trần Hưng Đạo
Chất liệu: Đồng đúc
Kích thước: Cao 1.8 mét, rộng 0.8 mét
Khối lượng: Khoảng 500 kilogram
Niên đại: Đúc năm 1980
Tác giả: Nghệ nhân Nguyễn Văn Đông

II. MÔ TẢ HIỆN VẬT

Tượng mô phỏng hình ảnh Đại tướng Trần Hưng Đạo đứng vững vàng,
tay phải cầm kiếm, ánh mắt hướng về phía trước đầy uy nghiêm.
Khuôn mặt thể hiện sự cương nghị, quyết đoán của một vị tướng tài.

Trang phục là áo giáp chiến binh thời Trần, trên ngực có khắc chữ "Trận".
Đế tượng bằng đá granite màu xám, khắc dòng chữ "Đại tướng Trần Quốc Tuấn".

III. Ý NGHĨA LỊCH SỬ

Trần Hưng Đạo (1228-1300), tên thật là Trần Quốc Tuấn, là danh tướng
nổi tiếng của triều đại nhà Trần. Ông đã 3 lần đánh tan quân xâm lược
Nguyên-Mông vào các năm 1258, 1285 và 1288.

Trận Bạch Đằng năm 1288 là chiến thắng vang dội, kết thúc bằng việc
đánh chìm toàn bộ hạm đội Nguyên Mông tại sông Bạch Đằng nhờ kế sách
cắm cọc ngầm.

IV. TRIẾT LÝ QUÂN SỰ

Trần Hưng Đạo nổi tiếng với chiến thuật "Vận dụng địa hình, đánh nhanh
thắng nhanh, dùng ít địch nhiều". Ông viết Binh thư yếu lược, tác phẩm
quân sự quan trọng của Việt Nam.

Câu nói nổi tiếng: "Thà tôi đầu làm ma quốc nội, còn hơn sống làm vương
đất khách" thể hiện tinh thần yêu nước, bất khuất của dân tộc.

V. GIÁ TRỊ VĂN HÓA

Tượng Trần Hưng Đạo không chỉ là tác phẩm nghệ thuật điêu khắc mà còn
là biểu tượng của tinh thần quật cường, bất khuất của dân tộc Việt Nam
trước ngoại xâm.

Hiện vật này được trưng bày tại Bảo tàng Lịch sử Quốc gia từ năm 1985,
thu hút hàng ngàn du khách mỗi năm.
"""
    
    # Viết content lên PDF
    y = height - 50
    line_height = 15
    
    for line in content.split('\n'):
        if y < 50:  # New page if needed
            c.showPage()
            y = height - 50
        
        if line.strip():
            c.drawString(50, y, line.strip())
        
        y -= line_height
    
    # Save PDF
    c.save()
    print(f"✅ Created test PDF: {output_path}")

if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tran_hung_dao.pdf"
    create_test_pdf(output)
    print(f"\n📄 Test PDF created at: {output}")
    print(f"\nTo upload:")
    print(f"curl -X POST http://localhost:8080/admin/upload-pdf/statue_tran_hung_dao \\")
    print(f"  -F 'file=@{output}'")
