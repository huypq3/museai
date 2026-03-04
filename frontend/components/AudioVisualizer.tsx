"use client";

import { useEffect, useRef } from "react";

type Props = {
  isActive: boolean;
  color?: string;
};

export default function AudioVisualizer({ isActive, color = "#3B82F6" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize bars
    const barCount = 32;
    barsRef.current = Array(barCount).fill(0);

    const animate = () => {
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / barCount;
      const maxHeight = canvas.height;

      barsRef.current.forEach((height, index) => {
        if (isActive) {
          // Animate bars with random heights
          const target = Math.random() * maxHeight * 0.8 + maxHeight * 0.2;
          barsRef.current[index] += (target - height) * 0.2;
        } else {
          // Fade out
          barsRef.current[index] *= 0.9;
        }

        const x = index * barWidth;
        const h = barsRef.current[index];
        const y = (maxHeight - h) / 2;

        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y, barWidth - 4, h);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, color]);

  return (
    <div className="w-full h-24 bg-slate-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={512}
        height={96}
        className="w-full h-full"
      />
    </div>
  );
}
