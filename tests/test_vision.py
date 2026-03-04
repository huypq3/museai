"""
Tests cho Vision Recognition - Sprint 3
"""

import pytest
import os
import sys
from io import BytesIO
from PIL import Image

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from vision.recognizer import recognize_artifact
from vision.camera_tour import analyze_frame, generate_commentary


def create_blank_image() -> bytes:
    """Tạo blank image cho testing."""
    img = Image.new('RGB', (640, 480), color=(128, 128, 128))
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_recognize_unknown():
    """Test nhận diện ảnh ngẫu nhiên → trả về unknown."""
    print("\n🧪 Test 1: Recognize unknown image")
    
    image_bytes = create_blank_image()
    
    result = await recognize_artifact(
        image_bytes=image_bytes,
        museum_id="demo_museum"
    )
    
    print(f"   Result: {result}")
    
    # Verify format
    assert "artifact_id" in result
    assert "confidence" in result
    assert "reasoning" in result
    assert "found" in result
    assert isinstance(result["confidence"], (int, float))
    assert isinstance(result["found"], bool)
    
    print(f"   ✅ Response format correct")
    print(f"   Artifact ID: {result['artifact_id']}")
    print(f"   Confidence: {result['confidence']}")
    print(f"   Found: {result['found']}")


@pytest.mark.asyncio
async def test_recognize_with_description():
    """Test với museum có artifacts → verify JSON format."""
    print("\n🧪 Test 2: Recognize with artifact list")
    
    image_bytes = create_blank_image()
    
    result = await recognize_artifact(
        image_bytes=image_bytes,
        museum_id="demo_museum"
    )
    
    # Verify có call được Gemini và parse JSON
    assert result is not None
    assert "artifact_id" in result
    assert "confidence" in result
    
    # Confidence phải trong range 0-1
    assert 0.0 <= result["confidence"] <= 1.0
    
    print(f"   ✅ Gemini Vision called successfully")
    print(f"   Artifact detected: {result['artifact_id']}")
    print(f"   Confidence: {result['confidence']:.2f}")
    print(f"   Reasoning: {result['reasoning'][:100]}...")


@pytest.mark.asyncio
async def test_camera_tour_same_artifact():
    """Test camera tour với cùng artifact → same=True."""
    print("\n🧪 Test 3: Camera tour - same artifact detection")
    
    image_bytes = create_blank_image()
    
    # Lần 1: phát hiện artifact
    result1 = await analyze_frame(
        image_bytes=image_bytes,
        museum_id="demo_museum",
        last_artifact_id=None
    )
    
    artifact_id = result1["artifact_id"]
    print(f"   First frame: {artifact_id}")
    
    # Lần 2: cùng artifact
    result2 = await analyze_frame(
        image_bytes=image_bytes,
        museum_id="demo_museum",
        last_artifact_id=artifact_id
    )
    
    print(f"   Second frame: same={result2['same']}")
    
    # Verify same=True
    assert result2["same"] == True
    assert result2["artifact_id"] == artifact_id
    
    print(f"   ✅ Same artifact detected correctly")


@pytest.mark.asyncio
async def test_generate_commentary():
    """Test generate commentary cho artifact."""
    print("\n🧪 Test 4: Generate commentary")
    
    # Test với pottery_ly artifact
    commentary = await generate_commentary(
        artifact_id="pottery_ly",
        language="vi"
    )
    
    print(f"   Commentary: {commentary}")
    
    assert commentary is not None
    assert len(commentary) > 0
    assert isinstance(commentary, str)
    
    print(f"   ✅ Commentary generated successfully")
    print(f"   Length: {len(commentary)} characters")


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("VISION RECOGNITION TESTS - SPRINT 3")
    print("="*60)
    
    import asyncio
    
    # Run tests
    asyncio.run(test_recognize_unknown())
    asyncio.run(test_recognize_with_description())
    asyncio.run(test_camera_tour_same_artifact())
    asyncio.run(test_generate_commentary())
    
    print("\n" + "="*60)
    print("✅ ALL VISION TESTS PASSED!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
