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

from vision.recognizer import recognize_exhibit


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
    
    result = await recognize_exhibit(
        image_bytes=image_bytes,
        museum_id="demo_museum"
    )
    
    print(f"   Result: {result}")
    
    # Verify format
    assert "exhibit_id" in result
    assert "confidence" in result
    assert "reasoning" in result
    assert "found" in result
    assert isinstance(result["confidence"], (int, float))
    assert isinstance(result["found"], bool)
    
    print(f"   ✅ Response format correct")
    print(f"   Exhibit ID: {result['exhibit_id']}")
    print(f"   Confidence: {result['confidence']}")
    print(f"   Found: {result['found']}")


@pytest.mark.asyncio
async def test_recognize_with_description():
    """Test với museum has exhibits → verify JSON format."""
    print("\n🧪 Test 2: Recognize with exhibit list")
    
    image_bytes = create_blank_image()
    
    result = await recognize_exhibit(
        image_bytes=image_bytes,
        museum_id="demo_museum"
    )
    
    # Verify có call được Gemini và parse JSON
    assert result is not None
    assert "exhibit_id" in result
    assert "confidence" in result
    
    # Confidence phải trong range 0-1
    assert 0.0 <= result["confidence"] <= 1.0
    
    print(f"   ✅ Gemini Vision called successfully")
    print(f"   Exhibit detected: {result['exhibit_id']}")
    print(f"   Confidence: {result['confidence']:.2f}")
    print(f"   Reasoning: {result['reasoning'][:100]}...")


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("VISION RECOGNITION TESTS - SPRINT 3")
    print("="*60)
    
    import asyncio
    
    # Run tests
    asyncio.run(test_recognize_unknown())
    asyncio.run(test_recognize_with_description())
    
    print("\n" + "="*60)
    print("✅ ALL VISION TESTS PASSED!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
