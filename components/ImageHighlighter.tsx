
import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { HighlightCoordinates } from '../types';

interface ImageHighlighterProps {
  imageUrl: string;
  onSelectionChange: (coords: HighlightCoordinates | null) => void;
  initialCoords: HighlightCoordinates | null;
}

export const ImageHighlighter: React.FC<ImageHighlighterProps> = ({ imageUrl, onSelectionChange, initialCoords }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<HighlightCoordinates | null>(initialCoords);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset internal selection if prop changes (e.g. clear)
  useEffect(() => {
    setSelection(initialCoords);
  }, [initialCoords]);

  const getRelativeCoords = (e: MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const coords = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);
    setSelection(null);
    onSelectionChange(null);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing) return;
    setCurrentPos(getRelativeCoords(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos || !imgRef.current) return;
    setIsDrawing(false);

    const width = imgRef.current.width;
    const height = imgRef.current.height;

    const x1 = Math.min(startPos.x, currentPos.x);
    const x2 = Math.max(startPos.x, currentPos.x);
    const y1 = Math.min(startPos.y, currentPos.y);
    const y2 = Math.max(startPos.y, currentPos.y);

    // Minimum size threshold to prevent accidental clicks
    if (x2 - x1 < 10 || y2 - y1 < 10) {
        setSelection(null);
        onSelectionChange(null);
        return;
    }

    const coords: HighlightCoordinates = {
      xmin: Math.round((x1 / width) * 1000),
      xmax: Math.round((x2 / width) * 1000),
      ymin: Math.round((y1 / height) * 1000),
      ymax: Math.round((y2 / height) * 1000),
    };

    setSelection(coords);
    onSelectionChange(coords);
  };

  const getSelectionStyle = () => {
    if (!selection || !imgRef.current) {
        if (isDrawing && startPos && currentPos) {
             const left = Math.min(startPos.x, currentPos.x);
             const top = Math.min(startPos.y, currentPos.y);
             const width = Math.abs(currentPos.x - startPos.x);
             const height = Math.abs(currentPos.y - startPos.y);
             return { left, top, width, height };
        }
        return null;
    }

    const width = imgRef.current.width;
    const height = imgRef.current.height;

    return {
        left: (selection.xmin / 1000) * width,
        top: (selection.ymin / 1000) * height,
        width: ((selection.xmax - selection.xmin) / 1000) * width,
        height: ((selection.ymax - selection.ymin) / 1000) * height,
    };
  };

  const rectStyle = getSelectionStyle();

  return (
    <div 
        ref={containerRef} 
        className="relative flex items-center justify-center cursor-crosshair select-none h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      <img 
        ref={imgRef} 
        src={imageUrl} 
        alt="Ad to highlight" 
        className="rounded-lg shadow-xl max-h-full max-w-full object-contain pointer-events-none block mx-auto" 
      />
      {rectStyle && (
        <div 
            className="absolute border-2 border-brand-primary bg-brand-primary/20 pointer-events-none"
            style={{
                left: rectStyle.left,
                top: rectStyle.top,
                width: rectStyle.width,
                height: rectStyle.height,
            }}
        >
            <div className="absolute -top-6 left-0 bg-brand-primary text-white text-[10px] px-2 py-1 rounded font-black uppercase tracking-tighter whitespace-nowrap">Target Area</div>
        </div>
      )}
    </div>
  );
};
