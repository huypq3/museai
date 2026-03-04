#!/usr/bin/env python3
"""
Tạo test image đơn giản để test Vision API.
"""

from PIL import Image, ImageDraw, ImageFont

# Tạo blank image
img = Image.new('RGB', (640, 480), color=(240, 240, 240))
draw = ImageDraw.Draw(img)

# Vẽ một hình chữ nhật (giả lập một artifact)
draw.rectangle([(200, 150), (440, 330)], fill=(180, 140, 100), outline=(100, 70, 50), width=3)

# Vẽ text
draw.text((320, 240), "TEST", fill=(255, 255, 255), anchor="mm")

# Save
output_path = "/tmp/test_image.jpg"
img.save(output_path, "JPEG")

print(f"✅ Created test image: {output_path}")
print(f"\nTo test Vision API:")
print(f"curl -X POST http://localhost:8080/vision/recognize/demo_museum \\")
print(f"  -F 'file=@{output_path}'")
