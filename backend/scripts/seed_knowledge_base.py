"""
Seed exhibit knowledge_base với embeddings vào Firestore.
Museum: Bảo tàng Dân tộc học Việt Nam
Exhibit: Trống đồng Đông Sơn (dong_son_drum)

Run:
  cd backend
  python scripts/seed_knowledge_base.py
"""

import asyncio
import os
import sys
import inspect
from google.cloud import firestore

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from live.rag_context import add_embeddings_to_chunks


# =============================================================================
# KNOWLEDGE BASE — Trống đồng Đông Sơn
# Nguồn: Wikipedia tiếng Việt, Bảo tàng Lịch sử Quốc gia, Cục Di sản Văn hóa,
#        VietnamPlus, nghiên cứu của TS. Nguyễn Văn Đoàn, Phạm Huy Thông.
# =============================================================================

KNOWLEDGE_BASE = {
    "dong_son_drum": [

        # ------------------------------------------------------------------
        # 1. Tổng quan & danh tính hiện vật
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_001",
            "category": "overview",
            "content": (
                "Trống đồng Đông Sơn (còn gọi là trống Heger loại I) là biểu tượng đỉnh cao của nền văn minh "
                "Việt cổ thời kỳ Hùng Vương. Trống tiêu biểu cho Văn hóa Đông Sơn tồn tại từ thế kỷ 7 TCN "
                "đến thế kỷ 6 SCN, chủ yếu ở đồng bằng sông Hồng và các tỉnh Bắc Bộ, Bắc Trung Bộ Việt Nam. "
                "Không chỉ là nhạc khí, trống còn là biểu tượng quyền lực, tôn giáo, và thành tựu kỹ thuật "
                "luyện kim đỉnh cao của người Lạc Việt — tổ tiên của người Việt Nam hiện đại."
            ),
        },

        # ------------------------------------------------------------------
        # 2. Bối cảnh lịch sử — Văn hóa Đông Sơn
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_002",
            "category": "historical_context",
            "content": (
                "Văn hóa Đông Sơn hình thành và phát triển trên nền tảng các văn hóa tiền Đông Sơn như "
                "Phùng Nguyên, Đồng Đậu và Gò Mun. Chủ nhân của nền văn hóa này là người Lạc Việt — "
                "cộng đồng sống bằng trồng lúa nước, săn bắt và đánh cá trên đồng bằng sông Hồng. "
                "Đây là thời kỳ đồ đồng phát triển vượt bậc: người Đông Sơn thành thạo luyện kim, "
                "tạo ra những kiệt tác đồ đồng mà văn minh Đông Nam Á thời bấy giờ chưa ai sánh kịp. "
                "Văn hóa Đông Sơn được coi là nền văn minh sơ khai đặc sắc nhất khu vực Đông Nam Á."
            ),
        },

        # ------------------------------------------------------------------
        # 3. Nguồn gốc phát hiện & phân loại khoa học
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_003",
            "category": "discovery",
            "content": (
                "Trống đồng Đông Sơn được phát hiện lần đầu vào năm 1924 tại làng Đông Sơn, tỉnh Thanh Hóa. "
                "Học giả người Áo Franz Heger năm 1902 đã hệ thống phân loại 165 chiếc trống đồng được biết "
                "đến lúc đó, trong đó trống Đông Sơn được xếp vào loại H1 — cổ nhất, cơ bản nhất, là khuôn "
                "mẫu cho các loại trống sau này. Về nguồn gốc, các nhà khảo cổ Việt Nam khẳng định quê hương "
                "trống đồng là vùng đồng bằng sông Hồng, Bắc Bộ Việt Nam, với bằng chứng là những chiếc trống "
                "cổ nhất được tìm thấy sớm nhất tại miền Bắc Việt Nam và Vân Nam vào khoảng 700–800 năm TCN."
            ),
        },

        # ------------------------------------------------------------------
        # 4. Cấu trúc & hình dáng tổng thể
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_004",
            "category": "physical_structure",
            "content": (
                "Trống đồng Đông Sơn có cấu trúc bốn phần rõ ràng: mặt trống (hình tròn phẳng), tang trống "
                "(phần hình thang nở phình ra — hoạt động như hộp cộng hưởng khuếch đại âm thanh), thân trống "
                "(hình trụ đứng) và chân trống (hình nón cụt hơi choãi — là cửa thoát âm thanh). "
                "Trống được đúc liền khối, mặt trống chờm ra khỏi tang. Quai trống thường làm theo hình dây thừng "
                "bện, bố trí từng cặp đối xứng ở tang và thân. Kích thước tiêu biểu của trống loại lớn: "
                "đường kính mặt 60–80cm, chiều cao 40–70cm, trọng lượng có thể lên tới 80–100kg."
            ),
        },

        # ------------------------------------------------------------------
        # 5. Hoa văn mặt trống — ngôi sao Mặt Trời
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_005",
            "category": "decoration_face",
            "content": (
                "Trung tâm mặt trống là ngôi sao nhiều cánh đúc nổi — thường 8, 12 hoặc 14 cánh — tượng trưng "
                "cho thần Mặt Trời, vị thần tối cao của người Lạc Việt cung cấp ánh sáng và năng lượng cho vạn vật. "
                "Ngôi sao còn đóng vai trò như bức thiên đồ giúp người Việt cổ xác định thời gian và các tiết trong năm. "
                "Xen giữa các cánh sao là họa tiết hình lông đuôi chim công (tượng trưng cho âm), trong khi "
                "ngôi sao tượng trưng cho dương — thể hiện triết lý âm dương hòa hợp sinh ra muôn loài. "
                "Bao quanh ngôi sao là các vành hoa văn đồng tâm với mật độ trang trí dày đặc và tinh xảo."
            ),
        },

        # ------------------------------------------------------------------
        # 6. Hoa văn mặt trống — cảnh sinh hoạt & lễ hội
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_006",
            "category": "decoration_scenes",
            "content": (
                "Các vành hoa văn trên mặt trống mô tả sống động đời sống của người Đông Sơn: người hóa trang "
                "lông chim nhảy múa, người giã gạo chày đôi, người đánh trống đồng trong lễ hội, cảnh đua thuyền "
                "trên sông, nhà sàn mái cong hình thuyền — kiến trúc đặc trưng của cư dân lúa nước. "
                "Hình ảnh con người luôn được diễn tả theo tư thế động: múa, bơi chải, đánh trống. "
                "Tất cả nhân vật và động vật đều diễu hành quanh ngôi sao trung tâm theo chiều ngược kim đồng hồ, "
                "phản ánh nghi lễ tế thần Mặt Trời. TS. Nguyễn Văn Đoàn ví trống như 'quyển sách bằng đồng' "
                "ghi lại toàn bộ văn hóa Đông Sơn bằng hình ảnh."
            ),
        },

        # ------------------------------------------------------------------
        # 7. Hoa văn — chim Lạc và thuyền chiến
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_007",
            "category": "decoration_birds_boats",
            "content": (
                "Chim Lạc (hay chim Hồng) là vật tổ của người Lạc Việt, xuất hiện dày đặc trên mặt trống ở nhiều "
                "tư thế: chim bay, chim đậu, chim đứng chầu mỏ vào nhau. Số lượng chim trên mỗi vành thường là 18 "
                "con — con số linh thiêng tượng trưng cho 18 đời Hùng Vương. Trên tang và thân trống có hình thuyền "
                "chiến với nhiều mái chèo, chiến binh mang vũ khí và nhạc cụ, phản ánh nền văn minh sông nước và "
                "sức mạnh quân sự của nhà nước Văn Lang. Hình ảnh thuyền cũng liên quan đến nghi lễ táng: "
                "người Đông Sơn quan niệm linh hồn người chết lên thuyền vượt sang thế giới bên kia."
            ),
        },

        # ------------------------------------------------------------------
        # 8. Kỹ thuật đúc — hợp kim & khuôn
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_008",
            "category": "casting_technique",
            "content": (
                "Trống đồng Đông Sơn được đúc bằng hợp kim đồng-thiếc-chì theo kỹ thuật khuôn hai mảnh. "
                "Để đúc thành công, người thợ phải đạt nhiều yêu cầu kỹ thuật khắt khe: duy trì nhiệt độ đủ cao "
                "để nung chảy hợp kim đồng, chọn vật liệu chịu lửa làm khuôn, nắm vững tính năng hóa lý "
                "của từng kim loại trong hợp kim. Rìa mặt trống còn in dấu các 'con kê' — những vật đệm nhỏ "
                "dùng để căn đều chiều dày thành trống trên khuôn đúc. Từ năm 1964–1975, Bảo tàng Lịch sử Việt Nam "
                "đã nhiều lần thử phục dựng trống Ngọc Lũ nhưng không thành công — minh chứng cho trình độ "
                "kỹ thuật phi thường của người thợ Đông Sơn. Mãi đến năm 2022, dựa trên mảnh khuôn đúc phát hiện "
                "tại Luy Lâu (Bắc Ninh), Bảo tàng Lịch sử Quốc gia mới đúc thực nghiệm thành công lần đầu tiên."
            ),
        },

        # ------------------------------------------------------------------
        # 9. Nghệ thuật trang trí — phong cách tạo hình
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_009",
            "category": "artistic_style",
            "content": (
                "Nghệ thuật trang trí trống đồng đặc trưng bởi kỹ thuật khắc chạm trên khuôn: hình ảnh trên mặt "
                "trống được khắc chìm, trên thân trống thì khắc nổi. Bố cục tròn trên mặt và bố cục ô chữ nhật "
                "trên thân, bên trong đều sắp xếp cân đối, hài hòa. Phong cách tạo hình người có nét tương đồng "
                "với nghệ thuật Ai Cập cổ đại: ngực hướng thẳng về phía khán giả trong khi chân và đầu nhìn nghiêng. "
                "Hoa văn hình học gồm: vòng tròn đồng tâm có chấm giữa, đường chữ ∫ gãy khúc nối tiếp, "
                "răng cưa, chấm nhỏ thẳng hàng — tạo nên nhịp điệu thị giác cuốn hút theo vòng tròn đồng tâm."
            ),
        },

        # ------------------------------------------------------------------
        # 10. Chức năng — nhạc khí & nghi lễ
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_010",
            "category": "function_ritual",
            "content": (
                "Trống đồng đảm nhiệm nhiều chức năng quan trọng trong xã hội Đông Sơn. Là nhạc khí, tiếng trống "
                "vang lên trong các lễ hội cộng đồng, lễ cầu mùa cầu cho lúa tốt, mưa thuận gió hòa. "
                "Trong chiến tranh, tiếng trống hiệu lệnh kêu gọi dân binh tập hợp, cổ vũ chiến đấu. "
                "Theo quan niệm tâm linh người Việt cổ, âm thanh kim loại có khả năng xua đuổi tà ma và "
                "điều không lành. Trống còn dùng trong lễ mai táng — chôn theo người chết như vật tùy táng "
                "quý giá, giúp linh hồn vượt sang thế giới bên kia. Một số trống nhỏ (trống minh khí) "
                "được chế tác riêng chỉ để chôn theo người chết, ít hoa văn hơn trống dùng trong lễ hội."
            ),
        },

        # ------------------------------------------------------------------
        # 11. Chức năng — biểu tượng quyền lực
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_011",
            "category": "function_power",
            "content": (
                "Trống đồng là biểu tượng quyền lực tối cao của thủ lĩnh và tầng lớp thống trị thời Hùng Vương. "
                "Chỉ vị thủ lĩnh có quyền uy và tài lực mới có thể huy động nhân lực đúc được chiếc trống lớn và đẹp. "
                "Trống đồng tượng trưng cho vương quyền và thần quyền Bách Việt — quyền lực chính trị gắn liền "
                "với quyền lực tâm linh. Theo tác giả Tạ Đức trong cuốn 'Nguồn gốc và sự phát triển của trống đồng "
                "Đông Sơn', An Dương Vương tại thành Cổ Loa là vị vua duy nhất có đủ điều kiện tạo ra những chiếc "
                "trống đồng lớn và đẹp nhất. Kích thước và mức độ tinh xảo của trống phản ánh trực tiếp địa vị "
                "xã hội của chủ nhân — trống càng lớn, hoa văn càng phong phú, chủ nhân càng quyền quý."
            ),
        },

        # ------------------------------------------------------------------
        # 12. Trống Ngọc Lũ — bảo vật tiêu biểu nhất
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_012",
            "category": "ngoc_lu_drum",
            "content": (
                "Trống đồng Ngọc Lũ là chiếc trống đẹp nhất và tiêu biểu nhất trong các trống Đông Sơn được "
                "phát hiện tại Việt Nam. Được người dân tìm thấy năm 1893 khi đắp đê tại xã Như Trác, huyện "
                "Nam Xang, tỉnh Hà Nam ở độ sâu 2 mét dưới bãi cát bồi. Kích thước: đường kính mặt 79,3cm, "
                "đường kính chân 80cm, cao 63cm, nặng 86kg. Có màu patin xanh xám đặc trưng. Mặt trống đúc nổi "
                "ngôi sao 14 cánh, bao quanh bởi 16 vành hoa văn cực kỳ phong phú: hình học, cảnh lễ hội, "
                "hươu đi cùng chim mỏ ngắn và chim mỏ dài, nhà sàn mái cong. Năm 1903 Viện Viễn Đông Bác cổ "
                "mua lại với giá 550 đồng bạc Đông Dương và đưa về Bảo tàng Louis Finot (nay là Bảo tàng Lịch sử "
                "Quốc gia). Được công nhận là Bảo vật Quốc gia theo Quyết định số 1426/QĐ-TTg ngày 1/10/2012."
            ),
        },

        # ------------------------------------------------------------------
        # 13. Sự lan tỏa & ảnh hưởng khu vực
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_013",
            "category": "regional_influence",
            "content": (
                "Trống đồng Đông Sơn không chỉ là sản phẩm riêng của người Việt cổ mà còn là kết quả giao lưu "
                "văn hóa rộng lớn. Trống được tìm thấy trải dài từ miền Nam Trung Quốc qua Việt Nam, Lào, "
                "Thái Lan đến tận Indonesia — minh chứng cho sức ảnh hưởng văn hóa phi thường của văn minh Đông Sơn. "
                "Sau khi văn hóa Đông Sơn sụp đổ dưới bước chân xâm lược của người Hoa Hạ, tầm ảnh hưởng của "
                "trống đồng không suy giảm mà còn mở rộng hơn. Bảo tàng Lịch sử Quốc gia Việt Nam hiện lưu giữ "
                "bộ sưu tập trống đồng Đông Sơn lớn nhất thế giới. Trống đồng Đông Sơn còn được trưng bày tại "
                "Bảo tàng Guimet (Paris, Pháp) và nhiều bảo tàng quốc tế danh tiếng."
            ),
        },

        # ------------------------------------------------------------------
        # 14. Bảo tàng Dân tộc học Việt Nam & vị trí hiện vật
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_014",
            "category": "museum_context",
            "content": (
                "Bảo tàng Dân tộc học Việt Nam tọa lạc tại đường Nguyễn Văn Huyên, quận Cầu Giấy, Hà Nội. "
                "Tòa nhà trưng bày chính được đặt tên là 'Tòa Trống Đồng' — lấy cảm hứng từ biểu tượng trống đồng "
                "Đông Sơn — giới thiệu toàn bộ 54 dân tộc anh em tại Việt Nam với hệ thống hiện vật phong phú "
                "về đời sống vật chất và tinh thần. Bảo tàng do kiến trúc sư Hà Đức Lịnh (người Tày) thiết kế, "
                "nội thất bởi kiến trúc sư Véronique Dollfus (Pháp). Mọi thông tin trưng bày đều thực hiện bằng "
                "3 ngôn ngữ: tiếng Việt, tiếng Anh và tiếng Pháp. Bảo tàng mở cửa thứ Ba đến Chủ Nhật "
                "(8h30–17h30), đóng cửa thứ Hai. Đây là một trong những bảo tàng được đánh giá cao nhất "
                "Đông Nam Á về phương pháp trưng bày hiện đại và khoa học."
            ),
        },

        # ------------------------------------------------------------------
        # 15. Di sản & ý nghĩa đương đại
        # ------------------------------------------------------------------
        {
            "chunk_id": "dsd_015",
            "category": "legacy_contemporary",
            "content": (
                "Trống đồng Đông Sơn ngày nay là biểu tượng văn hóa quốc gia của Việt Nam, xuất hiện trên "
                "quốc huy, tiền xu, con dấu nhà nước và các dịp lễ trọng đại. Nghi thức đánh trống đồng được "
                "phục hồi tại Đền Hùng trong ngày Giỗ Tổ Hùng Vương mồng 10 tháng 3 Âm lịch hằng năm. "
                "Tại Thanh Sơn (Phú Thọ) — vùng đất duy nhất còn ngày hội trống đồng của dân tộc Mường — "
                "lễ hội 'Đâm Đuống' và 'Chàm thau' vẫn được gìn giữ. Năm 2023, Bảo tàng Lịch sử Quốc gia "
                "khai mạc triển lãm 'Âm vang Đông Sơn', lần đầu tiên công bố phiên bản phục dựng trống đồng "
                "Luy Lâu gần giống bản gốc nhất, nhân dịp kỷ niệm 100 năm phát hiện và nghiên cứu văn hóa Đông Sơn. "
                "Nhà nghiên cứu Phạm Huy Thông từng viết: người kế thừa văn minh trống đồng không cần tự ti "
                "trước những người thừa hưởng văn minh kim tự tháp sông Nile."
            ),
        },
    ]
}


async def seed():
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set it in environment before running seed.")

    exhibits_collection = os.getenv("EXHIBITS_COLLECTION", "exhibits")
    include_ids_raw = os.getenv("SEED_EXHIBIT_IDS", "").strip()
    include_ids = {x.strip() for x in include_ids_raw.split(",") if x.strip()}

    db = firestore.AsyncClient(project=project_id)

    for exhibit_id, chunks in KNOWLEDGE_BASE.items():
        if include_ids and exhibit_id not in include_ids:
            continue
        print(f"📚 Generating embeddings for {exhibit_id} ({len(chunks)} chunks)...")
        add_embeddings_to_chunks(chunks)
        exhibit_ref = db.collection(exhibits_collection).document(exhibit_id)
        payload = {"knowledge_base": chunks, "exhibit_id": exhibit_id}
        await exhibit_ref.set(payload, merge=True)
        print(f"✅ Seeded {len(chunks)} chunks for {exhibit_id}")

    close_result = db.close()
    if inspect.isawaitable(close_result):
        await close_result


if __name__ == "__main__":
    asyncio.run(seed())
