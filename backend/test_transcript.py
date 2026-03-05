"""
Quick standalone test for Gemini Live transcript behavior.
Run:
  cd backend
  python test_transcript.py
"""

import asyncio
import os

from google import genai
from google.genai import types


MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
API_KEY = os.getenv("GEMINI_API_KEY")


def build_config():
    config = {
        "response_modalities": ["AUDIO"],
        "generation_config": {
            "temperature": 0.4,
            "thinking_config": {"include_thoughts": False, "thinking_budget": 0},
            "max_output_tokens": 300,
        },
    }

    if "output_audio_transcription" in types.LiveConnectConfig.model_fields:
        config["output_audio_transcription"] = {}
        print("✅ output_audio_transcription enabled")
    else:
        print("⚠️ SDK does not expose output_audio_transcription in LiveConnectConfig")

    return config


async def main():
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    print("Connecting to Gemini Live...")
    print("Model:", MODEL)
    client = genai.Client(api_key=API_KEY)
    config = build_config()

    async with client.aio.live.connect(model=MODEL, config=config) as session:
        print("Connected. Sending test prompt...")
        await session.send(
            input="Xin chao, hay gioi thieu ban than trong 1 cau ngan bang tieng Viet.",
            end_of_turn=True,
        )

        got_any = False
        async for response in session.receive():
            got_any = True

            if response.data:
                print(f"🔊 Audio: {len(response.data)} bytes")

            if response.server_content:
                sc = response.server_content
                output_tx = getattr(sc, "output_transcription", None)
                if output_tx and getattr(output_tx, "text", None):
                    print("📝 OUTPUT:", output_tx.text)
                else:
                    print("⚠️ server_content but output_transcription=None")
                    print("   model_turn:", getattr(sc, "model_turn", None) is not None)

                input_tx = getattr(sc, "input_transcription", None)
                if input_tx and getattr(input_tx, "text", None):
                    print("🎤 INPUT:", input_tx.text)

                if getattr(sc, "turn_complete", False):
                    print("✅ Turn complete")
                    break

        if not got_any:
            print("❌ No response received")


if __name__ == "__main__":
    asyncio.run(main())
