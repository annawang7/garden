import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

interface CanvasProps {
  brushColor: string;
  brushSize: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface CanvasRef {
  clearCanvas: () => void;
  createExportCanvas: () => HTMLCanvasElement | null;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(
  ({ brushColor, brushSize, className, style }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const tool = "pen";

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set high-resolution canvas size
      const pixelRatio = window.devicePixelRatio || 1;
      const displaySize = 224;

      // Set internal canvas resolution to high-DPI
      canvas.width = displaySize * pixelRatio;
      canvas.height = displaySize * pixelRatio;

      // Scale the context to ensure correct drawing operations
      ctx.scale(pixelRatio, pixelRatio);

      // Set default styles
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Clear canvas with transparent background
      ctx.clearRect(0, 0, displaySize, displaySize);
    }, []);

    const getCoordinates = (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        // Touch event
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      } else {
        // Mouse event
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
    };

    const startDrawing = (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { x, y } = getCoordinates(e);

      setIsDrawing(true);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>
    ) => {
      e.preventDefault();
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { x, y } = getCoordinates(e);

      if (tool === "pen") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = brushColor;
      } else {
        ctx.globalCompositeOperation = "destination-out";
      }

      ctx.lineWidth = brushSize;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      setIsDrawing(false);
    };

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas with transparent background (use display size, not internal size)
      ctx.clearRect(0, 0, 224, 224);
    };

    const createExportCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = 224;
      exportCanvas.height = 224;

      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return null;

      // Draw the high-resolution canvas scaled down to 224x224
      exportCtx.drawImage(canvas, 0, 0, 224, 224);

      return exportCanvas;
    };

    useImperativeHandle(ref, () => ({
      clearCanvas,
      createExportCanvas,
    }));

    return (
      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          className={className}
          style={{ width: "224px", height: "224px", ...style }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button
          onClick={clearCanvas}
          className="absolute top-2 right-2 w-8 h-8 text-gray-600 hover:text-black rounded-full text-xl cursor-pointer transition-colors duration-200 flex items-center justify-center"
          title="Clear"
        >
          ↺
        </button>
      </div>
    );
  }
);

Canvas.displayName = "Canvas";

export default Canvas;
