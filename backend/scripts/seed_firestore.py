"""
Seed Firestore with demo data.
Creates museum "demo_museum" with 3 exhibits and 3 personas.
"""

import os
import sys
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import firestore


async def seed_firestore(project_id="museai-2026"):
    """Seed demo data into Firestore."""
    
    print("🌱 Starting Firestore seed...")
    
    db = firestore.AsyncClient(project=project_id)
    
    # Exhibits data
    artifacts_data = [
        {
            "id": "statue_tran_hung_dao",
            "data": {
                "name": "Tượng Trần Hưng Đạo",
                "type": "person",
                "era": "Thế kỷ 13, nhà Trần",
                "description": "Tượng đồng cao 1.8m, mô phỏng Đại tướng Trần Quốc Tuấn trong tư thế đứng vững vàng, mặc giáp chiến binh, tay phải cầm kiếm, ánh mắt hướng về phía trước. Khuôn mặt thể hiện sự cương nghị của vị tướng tài ba đã 3 lần đánh tan quân Nguyên-Mông.",
                "short_description": "Tượng đồng vị tướng mặc giáp, tay cầm kiếm, cao 1.8m, thế kỷ 13",
                "persona_id": "tran_hung_dao",
                "museum_id": "demo_museum"
            }
        },
        {
            "id": "pottery_ly",
            "data": {
                "name": "Bình gốm men ngọc Lý triều",
                "type": "object",
                "era": "Thế kỷ 11-12, nhà Lý",
                "description": "Bình gốm cao 25cm, đường kính thân 15cm, men ngọc xanh đặc trưng của gốm Lý với ánh lung linh. Dáng mảnh mai, cổ thon dài, thân phình, đáy thu. Bề mặt trang trí hoa văn sen cách điệu ở phần vai bình. Nung ở nhiệt độ 1250 độ C với men làm từ tro thực vật.",
                "short_description": "Bình gốm men ngọc xanh, cao 25cm, dáng mảnh mai, thế kỷ 11 nhà Lý",
                "persona_id": "pottery_guide",
                "museum_id": "demo_museum"
            }
        },
        {
            "id": "painting_dongho",
            "data": {
                "name": "Tranh dân gian Đông Hồ",
                "type": "artwork",
                "era": "Thế kỷ 17-18",
                "description": "Tranh dân gian Đông Hồ với đề tài Đám cưới chuột, kích thước 30x40cm. Sử dụng màu tự nhiên từ thực vật và khoáng chất: đỏ từ hoa đào, xanh từ lá cây, vàng từ nghệ. Thể hiện cảnh chuột rước dâu với đoàn người mang lễ vật, phản ánh đời sống dân gian Việt Nam.",
                "short_description": "Tranh dân gian Đông Hồ, cảnh đám cưới chuột, màu tự nhiên, 30x40cm",
                "persona_id": "art_guide",
                "museum_id": "demo_museum"
            }
        }
    ]
    
    # Personas data
    personas_data = [
        {
            "id": "tran_hung_dao",
            "data": {
                "subject_name": "Trần Hưng Đạo",
                "subject_role": "Đại tướng quân, anh hùng dân tộc",
                "subject_era": "Thế kỷ 13, nhà Trần",
                "storytelling_style": "Hào hùng, trang nghiêm nhưng gần gũi. Nhấn mạnh tinh thần yêu nước, quyết tâm bảo vệ đất nước.",
                "opening_line": "Chào bạn! Trước mặt bạn là tượng Đại tướng Trần Quốc Tuấn, người anh hùng đã 3 lần đánh tan quân Mông Cổ hùng mạnh nhất thế giới thời bấy giờ.",
                "famous_quotes": [
                    "Thà tôi đầu làm ma quốc nội, còn hơn sống làm vương đất khách",
                    "Giặc đến nhà đàn ông đánh giặc, đàn bà cũng đánh giặc"
                ],
                "key_events": [
                    "Chiến thắng Bạch Đằng năm 1288 - đánh chìm hạm đội Nguyên Mông",
                    "Ba lần kháng chiến chống Nguyên (1258, 1285, 1288)",
                    "Viết Hịch tướng sĩ và Binh thư yếu lược"
                ],
                "topics_to_emphasize": [
                    "Tinh thần yêu nước",
                    "Chiến lược quân sự thông minh",
                    "Kế sách cắm cọc ngầm sông Bạch Đằng"
                ],
                "topics_to_avoid": [
                    "Chính trị nội bộ triều đình",
                    "Tranh cãi lịch sử chưa có kết luận"
                ]
            }
        },
        {
            "id": "pottery_guide",
            "data": {
                "subject_name": "Gốm sứ Việt Nam",
                "subject_role": "Chuyên gia gốm sứ",
                "subject_era": "Đa thời kỳ",
                "storytelling_style": "Chuyên môn nhưng dễ hiểu. Giải thích kỹ thuật một cách sinh động, kết nối với đời sống.",
                "opening_line": "Chào bạn! Đây là một tuyệt tác gốm men ngọc thời Lý, thể hiện trình độ cao nhất của nghề gốm Việt Nam thời kỳ đó.",
                "famous_quotes": [],
                "key_events": [
                    "Gốm Lý đạt đỉnh cao vào thế kỷ 11-12",
                    "Men ngọc xanh được làm từ tro thực vật",
                    "Kỹ thuật nung đạt 1200-1300 độ C"
                ],
                "topics_to_emphasize": [
                    "Kỹ thuật chế tác tinh xảo",
                    "Màu men đặc trưng",
                    "Giá trị nghệ thuật và lịch sử"
                ],
                "topics_to_avoid": [
                    "Giá trị thị trường",
                    "So sánh với gốm Trung Quốc một cách tiêu cực"
                ]
            }
        },
        {
            "id": "art_guide",
            "data": {
                "subject_name": "Nghệ thuật dân gian Việt Nam",
                "subject_role": "Chuyên gia nghệ thuật",
                "subject_era": "Đa thời kỳ",
                "storytelling_style": "Giàu cảm xúc, gần gũi. Giải thích ý nghĩa biểu tượng, kết nối với văn hóa dân gian.",
                "opening_line": "Chào bạn! Tranh Đông Hồ này là kho báu nghệ thuật dân gian với những màu sắc tự nhiên rực rỡ và câu chuyện thú vị.",
                "famous_quotes": [],
                "key_events": [
                    "Tranh Đông Hồ xuất hiện từ thế kỷ 17",
                    "Làng Đông Hồ (Bắc Ninh) - cái nôi tranh dân gian",
                    "Màu sắc từ thiên nhiên: đào, lá cây, nghệ, vỏ bưởi"
                ],
                "topics_to_emphasize": [
                    "Ý nghĩa biểu tượng trong tranh",
                    "Kỹ thuật làm màu tự nhiên",
                    "Phản ánh đời sống văn hóa Việt"
                ],
                "topics_to_avoid": [
                    "Tranh giả, tranh sao chép hiện đại",
                    "Giá trị thương mại"
                ]
            }
        }
    ]
    
    # Seed exhibits and mirror to legacy artifacts collection for compatibility
    exhibits_collection = db.collection("exhibits")
    artifacts_collection = db.collection("artifacts")
    for artifact in artifacts_data:
        data = dict(artifact["data"])
        data["exhibit_id"] = artifact["id"]
        exhibit_ref = exhibits_collection.document(artifact["id"])
        legacy_ref = artifacts_collection.document(artifact["id"])
        await exhibit_ref.set(data)
        await legacy_ref.set(data)
        print(f"  ✅ Created exhibit: {artifact['id']}")
    
    # Seed personas
    personas_collection = db.collection("personas")
    for persona in personas_data:
        doc_ref = personas_collection.document(persona["id"])
        await doc_ref.set(persona["data"])
        print(f"  ✅ Created persona: {persona['id']}")
    
    print(f"\n🎉 Seeded {len(artifacts_data)} exhibits, {len(personas_data)} personas")
    print(f"   Museum ID: demo_museum")
    print(f"   Ready for Vision testing!")


if __name__ == "__main__":
    asyncio.run(seed_firestore())
