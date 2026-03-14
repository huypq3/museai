import asyncio
import os
from google.cloud import firestore
from vertexai.language_models import TextEmbeddingModel

EXHIBIT_ID = "dong_ho_baby_fish"

CHUNKS_RAW = [
    {"category": "overview", "content": "Tranh Đông Hồ 'Em Bé Ôm Cá Chép' là một trong những bức tranh chúc tụng tiêu biểu nhất của dòng tranh dân gian làng Đông Hồ (xã Song Hồ, huyện Thuận Thành, tỉnh Bắc Ninh). Bức tranh mô tả hình ảnh một bé gái mũm mĩm, bụ bẫm đang ôm chặt một con cá chép to và nặng, nét mặt tươi vui rạng rỡ. Đây là lời nguyện ước của ông cha gửi gắm cho thế hệ trẻ: cầu con cái học giỏi, cuộc đời sung túc và ý chí mạnh mẽ vượt qua mọi sóng gió."},
    {"category": "symbol", "content": "Cá chép trong văn hóa dân gian Việt Nam tượng trưng cho phú quý sung túc, học hành thăng tiến và tinh thần kiên cường vượt khó. Xuất phát từ truyền thuyết 'Cá chép hóa rồng': cá chép bơi ngược dòng vượt qua vũ môn sẽ hóa thành rồng. Trong tiếng Hán, 'ngư' (cá) đồng âm với 'dư' (dư dả, sung túc). Cá chép còn là biểu tượng của con đàn cháu đống vì loài cá này đẻ rất nhiều trứng."},
    {"category": "symbol", "content": "Hình ảnh em bé trong tranh Đông Hồ luôn được vẽ mũm mĩm, bụ bẫm — gọi là 'tính phồn thực'. Đường nét đầy đặn, căng tròn biểu thị ước mơ về sức khỏe, no đủ, sung mãn và hạnh phúc. Bé gái ôm chặt cá to và nặng thể hiện sự kiên cường và quyết tâm. Hình ảnh này thường được ghép cùng 'Em Bé Ôm Tôm' thành bộ đôi treo Tết."},
    {"category": "context", "content": "Tranh Đông Hồ có bộ tứ tranh chúc tụng: Lễ Trí (em bé ôm rùa), Nhân Nghĩa (em bé ôm cóc), Vinh Hoa (em bé ôm gà), Phú Quý (em bé ôm vịt). Ngoài ra 'Em Bé Ôm Cá Chép' là tranh chúc tụng riêng biệt. Các tranh được treo dịp Tết Nguyên Đán để mang lại may mắn, thịnh vượng cho gia đình trong năm mới."},
    {"category": "technique", "content": "Giấy in tranh Đông Hồ là 'giấy điệp': nghiền nát vỏ con điệp (sò biển), trộn với hồ bột gạo, quét nhiều lớp lên giấy dó bằng chổi lá thông. Tạo nền trắng ngà lấp lánh tự nhiên. Đây là đặc trưng không thể nhầm lẫn của tranh Đông Hồ so với mọi dòng tranh khác."},
    {"category": "technique", "content": "Màu sắc tranh Đông Hồ hoàn toàn từ thiên nhiên: đỏ từ sỏi son và gỗ vang, vàng từ hoa dành dành và hoa hòe, xanh từ gỉ đồng hoặc lá chàm, đen từ than lá tre ngâm chum vại nhiều tháng, trắng từ vỏ điệp. Các màu trộn với bột nếp trước khi in. Chính sự tinh khiết này tạo vẻ mộc mạc đằm thắm đặc trưng."},
    {"category": "technique", "content": "Tranh Đông Hồ in từ ván khắc gỗ thủ công. Ván in nét làm từ gỗ thị hoặc gỗ thừng mực, ván in màu làm từ gỗ mỡ. Bao nhiêu màu cần bấy nhiêu ván khắc. In màu đậm trước, màu nhạt sau, nét đen in cuối cùng. Phải chờ mỗi màu khô mới in tiếp. Dụng cụ khắc là bộ ve (mũi đục thép) gồm 30-40 chiếc."},
    {"category": "history", "content": "Làng tranh Đông Hồ (làng Mái, làng Hồ) thuộc xã Song Hồ, huyện Thuận Thành, tỉnh Bắc Ninh — cách Hà Nội 25km. Nằm trên bờ nam sông Đuống. Nghề làm tranh hình thành từ khoảng thế kỷ XVI. Xưa bán rộng rãi dịp Tết — người dân mua dán tường, hết năm thay mới. Nay bán như sản phẩm văn hóa và quà tặng."},
    {"category": "heritage", "content": "Năm 2012, 'Nghề làm tranh dân gian Đông Hồ' được công nhận Di sản văn hóa phi vật thể quốc gia. Bộ Văn hóa phối hợp UBND tỉnh Bắc Ninh lập hồ sơ trình UNESCO. Tỉnh Bắc Ninh có nhiều chương trình bảo tồn: quy hoạch khu làng nghề, hỗ trợ nghệ nhân, đưa vào giáo dục và du lịch. Có thể tham quan tại làng Đông Hồ hoặc xem tại 19 ngõ 179 Hoàng Hoa Thám, Ba Đình, Hà Nội."},
    {"category": "context", "content": "Tranh Đông Hồ gắn liền với Tết Nguyên Đán. Tú Xương nhắc tranh Đông Hồ cùng thịt mỡ dưa hành câu đối đỏ. Hoàng Cầm viết: 'Tranh Đông Hồ gà lợn nét tươi trong / Màu dân tộc sáng bừng trên giấy điệp.' Tranh chúc tụng như Em Bé Ôm Cá Chép được treo cầu may mắn năm mới."},
    {"category": "symbol", "content": "Truyền thuyết 'Cá chép hóa rồng': vũ môn là cánh cổng trên trời, cá chép nào vượt qua sẽ hóa thành rồng. Phải bơi ngược dòng nước xiết với sức mạnh và kiên trì phi thường. Trở thành ẩn dụ cho học hành thi cử trong chế độ khoa cử. Bé gái ôm cá chép = ôm ấp ước mơ, nuôi dưỡng ý chí vượt qua vũ môn cuộc đời."},
    {"category": "technique", "content": "Tranh Đông Hồ có 7 thể loại: tranh thờ, tranh chúc tụng, tranh lịch sử, tranh truyện, tranh phương ngôn, tranh cảnh vật và tranh sinh hoạt. Các bức nổi tiếng: Đám Cưới Chuột (châm biếm phong kiến), Đàn Gà Mẹ Con (hạnh phúc gia đình), Cá Chép Trông Trăng (thăng tiến sự nghiệp), Chăn Trâu Thổi Sáo (bình yên làng quê)."},
    {"category": "context", "content": "Khác với tranh Hàng Trống (Hà Nội) rực rỡ, bán in bán vẽ tay, gắn tầng lớp thị dân — tranh Đông Hồ in ván khắc gỗ hoàn toàn, màu tự nhiên, nền giấy điệp lấp lánh, mộc mạc đậm đà, gắn đời sống nông dân bình dị vùng đồng bằng Bắc Bộ."},
    {"category": "overview", "content": "Bảo tàng Dân tộc học Việt Nam tại đường Nguyễn Văn Huyên, quận Cầu Giấy, Hà Nội. Mở cửa Thứ Ba đến Chủ Nhật 08:30-17:30, đóng thứ Hai. Vé: 40.000 VNĐ người lớn, 20.000 VNĐ trẻ em, miễn phí dưới 6 tuổi. Tranh Đông Hồ Em Bé Ôm Cá Chép trưng bày tại Nhà Việt Nam, tầng 1, khu nghệ thuật dân gian."},
    {"category": "technique", "content": "Để cảm nhận tranh Đông Hồ: 1) Giấy điệp — nền trắng ngà lấp lánh đặc trưng. 2) Màu sắc — đỏ vàng xanh đen trầm ấm từ thiên nhiên. 3) Đường nét — nét khắc gỗ đậm dứt khoát, viền đen cuối cùng tạo cân đối. 4) Bố cục — đơn giản, hình trung tâm nổi bật. 5) Biểu tượng — mỗi con vật, màu sắc đều mang ý nghĩa riêng."},
]

async def main():
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    print(f"Project: {project_id}")
    print(f"Exhibit: {EXHIBIT_ID}")
    print(f"Loading embedding model...")

    model = TextEmbeddingModel.from_pretrained(
        os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    )

    print(f"Generating embeddings for {len(CHUNKS_RAW)} chunks...")
    chunks_with_embeddings = []
    for i, chunk in enumerate(CHUNKS_RAW):
        emb = model.get_embeddings([chunk["content"]])[0]
        chunk["embedding"] = list(emb.values)
        chunks_with_embeddings.append(chunk)
        print(f"  ✅ [{i+1:2d}/{len(CHUNKS_RAW)}] {chunk['category']} — {chunk['content'][:60]}...")

    db = firestore.AsyncClient(project=project_id)
    await db.collection("exhibits").document(EXHIBIT_ID).set(
        {"knowledge_base": chunks_with_embeddings},
        merge=True
    )
    print(f"\n🎉 Done! {len(chunks_with_embeddings)} chunks với embeddings → exhibits/{EXHIBIT_ID}.knowledge_base")
    await db.close()

asyncio.run(main())
EOF