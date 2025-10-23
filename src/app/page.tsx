"use client";

import Head from "next/head";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase, uploadImage, saveMetadata } from "../../lib/supabase";
import { Walter_Turncoat } from "next/font/google";
import Canvas, { CanvasRef } from "../../components/Canvas";

const rubikDoodleShadow = Walter_Turncoat({
  weight: "400",
  subsets: ["latin"],
});

interface Drawing {
  id: number;
  filename: string;
  image_url: string;
  confidence: number;
  created_at: string;
}

export const Flower = ({
  flower,
  position,
  index,
}: {
  flower: Drawing;
  position: { left: string; top: string; scale: number };
  index: number;
}) => {
  // Generate random delay between 0 and 3 seconds
  const randomDelay = index / 10;

  return (
    <div
      className="absolute transition-all duration-300 ease-out cursor-pointer group bottom-0"
      style={{
        left: position.left,
        top: position.top,
        transform: `scale(${position.scale})`,
        transformOrigin: "center",
        width: 100,
        height: 100,
        objectFit: "cover",
        zIndex: Math.floor(parseFloat(position.top)), // Higher z-index for lower positions
      }}
    >
      <div
        style={{
          animation: `growIn 0.5s ease-out forwards`,
          animationDelay: `${randomDelay}s`,
          transform: "scale(0)",
          transformOrigin: "bottom",
        }}
        onClick={() => console.log(flower.id)}
      >
        <img
          key={flower.id}
          src={flower.image_url}
          alt={`Flower ${flower.id}`}
          className="group-hover:scale-125 transition-all duration-300 ease-out bottom-0 group-hover:bottom-2"
        />
      </div>
    </div>
  );
};

export default function Garden() {
  const [plantType, setPlantType] = useState<"flowers" | "eggplants">(
    "flowers"
  );
  const [flowers, setFlowers] = useState<Drawing[]>([]);
  const [eggplants, setEggplants] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [brushColor, setBrushColor] = useState("#EB3963");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [caption, setCaption] = useState(`Add ${plantType} to our garden? `);
  const [displayedCaption, setDisplayedCaption] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const canvasRef = useRef<CanvasRef>(null);

  const colors = [
    "#EB3963", // Red
    "#FFAFA6", // Pink
    "#F7FF0B", // Yellow
    "#A1DBFF", // Blue
    "#206A00", // Green
  ];

  useEffect(() => {
    fetchFlowers();
    fetchEggplants();
  }, []);

  // Typing effect for caption
  useEffect(() => {
    if (caption === displayedCaption) return;

    setIsTyping(true);

    // let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < caption.length - 1) {
        setDisplayedCaption(caption.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsTyping(false);
        setCurrentIndex(0);
        setTimeout(() => clearInterval(typingInterval), 1);
      }
    }, 50); // 50ms delay between characters

    return () => clearInterval(typingInterval);
  }, [caption, displayedCaption]);

  const analyzeImageData = async (imageData: string) => {
    const response = await fetch("/api/moderate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageData }),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze image");
    }

    return await response.json();
  };

  const saveDrawing = async () => {
    setIsAnalyzing(true);

    try {
      const exportCanvas = canvasRef.current?.createExportCanvas();
      if (!exportCanvas) return;

      const imageData = exportCanvas.toDataURL();

      // Analyze the image first
      let analysisResult;
      try {
        analysisResult = await analyzeImageData(imageData);
      } catch (analysisError) {
        console.error("Error during analysis:", analysisError);
        setIsAnalyzing(false);
        return;
      }

      // If it's detected as a flower, upload to Supabase
      if (analysisResult && analysisResult.isFlower) {
        try {
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            exportCanvas.toBlob((blob) => {
              resolve(blob!);
            }, "image/png");
          });

          const filename = `flower-${Date.now()}.png`;

          // Upload to Supabase
          const uploadResult = await uploadImage(blob, filename);

          if (uploadResult.success) {
            // Save metadata
            await saveMetadata(
              "flowers",
              filename,
              uploadResult.url!,
              analysisResult.flowerProbability
            );

            // Refresh the flowers list
            fetchFlowers();
          }
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
        }
      } else if (analysisResult.probabilities["a doodle of a penis"] > 0.95) {
        try {
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            exportCanvas.toBlob((blob) => {
              resolve(blob!);
            }, "image/png");
          });

          const filename = `eggplant-${Date.now()}.png`;

          // Upload to Supabase
          const uploadResult = await uploadImage(blob, filename);

          if (uploadResult.success) {
            // Save metadata
            await saveMetadata(
              "eggplants",
              filename,
              uploadResult.url!,
              analysisResult.probabilities["a doodle of a penis"]
            );

            // Refresh the flowers list
            fetchEggplants();
          }
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
        }

        setCaption("Ummm... O.o what's that? ");
        setDisplayedCaption("");

        setTimeout(() => {
          setCaption("I guess this is more your speed? ");
          setPlantType("eggplants");
          setDisplayedCaption("");
        }, 2000);
      } else {
        setCaption("That's not a flower. Try again? ");
        setDisplayedCaption("");

        setTimeout(() => {
          setCaption("Add a flower to our garden? ");
          setDisplayedCaption("");
        }, 5000);
      }
    } catch (error) {
      console.error("Error during save:", error);
    } finally {
      setIsAnalyzing(false);
      canvasRef.current?.clearCanvas();
    }
  };

  // Generate non-overlapping positions for flowers
  const generateFlowerPositions = (flowerCount: number) => {
    const positions: Array<{ left: string; top: string; scale: number }> = [];
    const minDistance = 8; // Minimum distance between flowers (in percentage points)
    console.log("generating positions");

    for (let i = 0; i < flowerCount; i++) {
      let attempts = 0;
      let validPosition = false;
      let newPosition;

      while (!validPosition && attempts < 50) {
        const topPercent = Math.random() * 65; // Island area (20% to 80%)
        let leftPercent;

        if (topPercent < 20) {
          leftPercent = 10 + Math.random() * 60; // Island area (20% to 80%)
        } else if (topPercent < 50) {
          leftPercent = 40 + Math.random() * 30; // Island area (20% to 80%)
        } else {
          leftPercent = 10 + Math.random() * 40; // Island area (20% to 60%)
        }

        // Scale flowers based on vertical position - closer to bottom = bigger
        const scale = 0.5 + (topPercent / 65) * 0.3; // 0.3 to 1.0 scale

        newPosition = {
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          scale: scale,
          leftNum: leftPercent,
          topNum: topPercent,
        };

        // Check if this position is too close to existing positions
        validPosition = positions.every((pos) => {
          const existingLeft = parseFloat(pos.left);
          const existingTop = parseFloat(pos.top);
          const xDistance = Math.abs(leftPercent - existingLeft);
          const yDistance = Math.abs(topPercent - existingTop);
          return xDistance >= minDistance || yDistance >= minDistance;
        });

        attempts++;
      }

      if (newPosition) {
        positions.push({
          left: newPosition.left,
          top: newPosition.top,
          scale: newPosition.scale,
        });
      }
    }

    console.log(positions);
    return positions;
  };

  const fetchFlowers = async () => {
    try {
      const { data, error } = await supabase
        .from("flowers")
        .select("*")
        .or("manual_moderation.is.null,manual_moderation.eq.false")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setFlowers(data || []);
    } catch (err) {
      console.error("Error fetching flowers:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch flowers");
    } finally {
      setLoading(false);
    }
  };

  const fetchEggplants = async () => {
    try {
      const { data, error } = await supabase
        .from("eggplants")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setEggplants(data || []);
    } catch (err) {
      console.error("Error fetching eggplants:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch eggplants"
      );
    } finally {
      setLoading(false);
    }
  };

  // Generate positions for flowers
  const flowerPositions = useMemo(
    () => generateFlowerPositions(flowers.length),
    [flowers.length]
  );

  return (
    <div
      className={`min-h-screen overflow-auto flex flex-col items-center justify-start relative ${rubikDoodleShadow.className}`}
      style={{
        background: "#fffff3",
      }}
    >
      <Head>
        <title>Garden - Anna Wang</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Island background */}
      <div className="md:absolute md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-10 flex md:gap-20 gap-10 flex-col md:flex-row w-full justify-center items-center">
        <div style={{ animation: "bob 3s ease-in-out infinite" }}>
          <img
            src="/island.png"
            alt="Garden island"
            className="flex-1 max-w-full w-[500px]"
          />

          {/* Flowers positioned on the island */}
          {!loading &&
            !error &&
            (plantType === "flowers" ? flowers : eggplants).map(
              (flower, index) => {
                const position = flowerPositions[index];
                if (!position) return null;

                return (
                  <Flower
                    key={flower.id}
                    flower={flower}
                    position={position}
                    index={index}
                  />
                );
              }
            )}
        </div>

        {/* Drawing area positioned to the right of the garden */}
        <div className="z-20 flex flex-col gap-3 items-center">
          {/* Drawing tools row */}
          {/* Caption */}
          <div className="text-sm text-gray-600 text-center font-medium pl-10">
            {plantType === "eggplants" && (
              <button
                className="text-xs text-green-800 hover:underline"
                onClick={() => {
                  setPlantType("flowers");
                  setCaption("Add a flower to our garden? ");
                  setDisplayedCaption("");
                }}
              >
                ← Back to nice garden{" "}
              </button>
            )}
            <p>
              {displayedCaption ?? " "}
              {isTyping && <span className="animate-pulse">|</span>}
            </p>
          </div>

          <div className="flex gap-4 mb-3">
            {/* Color Picker - Left of canvas */}
            <div className="flex flex-col gap-2 py-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                    brushColor === color
                      ? "border-gray-800 shadow-lg scale-110"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Select ${color}`}
                />
              ))}
            </div>
            <div className="flex flex-col items-center gap-2">
              {/* Canvas */}
              <Canvas
                ref={canvasRef}
                brushColor={brushColor}
                brushSize={10}
                className="border-4 border-gray-600 border-dashed rounded cursor-crosshair touch-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={saveDrawing}
                  disabled={isAnalyzing}
                  className={`py-1 px-2 flex items-center justify-center rounded-full ${
                    rubikDoodleShadow.className
                  } text-sm border border-green-800 shadow-md hover:scale-110 ${
                    isAnalyzing ? "text-gray-400" : "text-green-800"
                  }`}
                  title="Add plant"
                >
                  {isAnalyzing ? "🌱 Planting..." : "🌱 Plant"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bob {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes growIn {
          0% {
            transform: scale(0.5);
            transform-origin: bottom;
          }
          50% {
            transform: scale(0.95);
            transform-origin: bottom;
          }
          100% {
            transform: scale(1);
            transform-origin: bottom;
          }
        }
      `}</style>

      {/* Error state */}
      {error && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error loading garden</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && flowers.length === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="text-center text-green-100">
            <p className="text-4xl mb-2">🌱</p>
          </div>
        </div>
      )}

      {/* Gallery Link */}
      <a
        href="/gallery"
        className="fixed bottom-8 right-8 py-1 px-3 flex items-center justify-center rounded-full text-sm border border-green-800 shadow-md hover:scale-110 text-green-800 transition-transform z-50"
        title="View Gallery"
      >
        🖼️ See flower gallery
      </a>
    </div>
  );
}
