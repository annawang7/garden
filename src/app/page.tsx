"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Walter_Turncoat } from "next/font/google";
import { CanvasRef } from "../../components/Canvas";
import { DrawFlower } from "../../components/DrawFlower";

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
      className="absolute transition-all duration-300 ease-out cursor-pointer group bottom-0 md:w-[100px] md:h-[100px] w-[75px] h-[75px]"
      style={{
        left: position.left,
        top: position.top,
        transform: `scale(${position.scale})`,
        transformOrigin: "center",
        objectFit: "cover",
        zIndex: Math.floor(parseFloat(position.top)), // Higher z-index for lower positions
      }}
    >
      <div
        className="animate-growIn"
        style={{
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [caption, setCaption] = useState(`Add ${plantType} to our garden? `);
  const [displayedCaption, setDisplayedCaption] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showCanvasOverlay, setShowCanvasOverlay] = useState(false);
  const canvasRef = useRef<CanvasRef>(null);

  useEffect(() => {
    fetchFlowers();
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

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited
        throw new Error(
          result.message || "You've planted 10 flowers already! Thank you!"
        );
      }
      throw new Error("Failed to analyze image");
    }

    return result;
  };

  const saveDrawing = async () => {
    setIsAnalyzing(true);

    try {
      // Check localStorage for client-side limit
      const flowerCount = parseInt(localStorage.getItem("flowerCount") || "0");
      if (flowerCount >= 10) {
        setCaption("You've planted 10 flowers already! Thank you!");
        setDisplayedCaption("");
        setIsAnalyzing(false);
        return;
      }

      const exportCanvas = canvasRef.current?.createExportCanvas();
      if (!exportCanvas) return;

      const imageData = exportCanvas.toDataURL();

      // Analyze the image first
      let analysisResult;
      try {
        analysisResult = await analyzeImageData(imageData);
      } catch (analysisError) {
        console.error("Error during analysis:", analysisError);

        // Check if it's a rate limit error
        if (
          analysisError instanceof Error &&
          analysisError.message.includes("maximum")
        ) {
          setCaption(analysisError.message);
          setDisplayedCaption("");
          // Update localStorage to prevent future attempts
          localStorage.setItem("flowerCount", "10");
        }

        setIsAnalyzing(false);
        return;
      }

      if (
        analysisResult &&
        ["100.0.112.35", "174.224.191.189"].includes(analysisResult.ip)
      ) {
        setCaption("That's not a flower. Try again? ");
        setDisplayedCaption("");

        setTimeout(() => {
          setCaption("Add a flower to our garden? ");
          setDisplayedCaption("");
        }, 5000);
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

          const formData = new FormData();
          formData.append("file", blob);
          formData.append("plantType", "flowers");
          formData.append(
            "probability",
            analysisResult.flowerProbability.toString()
          );

          await fetch("/api/save-image", {
            method: "POST",
            body: formData,
          });

          // Increment localStorage counter
          const currentCount = parseInt(
            localStorage.getItem("flowerCount") || "0"
          );
          localStorage.setItem("flowerCount", String(currentCount + 1));

          // // Check if they've hit the limit
          // if (currentCount + 1 >= 10) {
          //   setCaption("That's your 10th flower! Thank you! 🌸");
          //   setDisplayedCaption("");
          // }

          // Refresh the flowers list
          setShowCanvasOverlay(false);
          fetchFlowers();
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
        }
      } else if (analysisResult && analysisResult.isEggplant) {
        try {
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            exportCanvas.toBlob((blob) => {
              resolve(blob!);
            }, "image/png");
          });

          const formData = new FormData();
          formData.append("file", blob);
          formData.append("plantType", "eggplants");
          formData.append(
            "probability",
            analysisResult.eggplantProbability.toString()
          );

          await fetch("/api/save-image", {
            method: "POST",
            body: formData,
          });

          // Refresh the flowers list
          fetchEggplants();
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
        }

        setCaption("Ummm... O.o what's that? ");
        setDisplayedCaption("");

        setTimeout(() => {
          setCaption("I guess this is more your speed? ");
          setPlantType("eggplants");
          setDisplayedCaption("");
          setShowCanvasOverlay(false);
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

    for (let i = 0; i < flowerCount; i++) {
      let attempts = 0;
      let validPosition = false;
      let newPosition;

      while (!validPosition && attempts < 50) {
        const topPercent = Math.random() * 65; // Island area (20% to 80%)
        let leftPercent;

        if (topPercent < 20) {
          leftPercent = 10 + Math.random() * 60; // Island area (20% to 80%)
        } else if (topPercent < 60) {
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

    return positions;
  };

  const fetchFlowers = async () => {
    try {
      const { data, error } = await supabase
        .from("public_flowers")
        .select("*")
        .lt("created_at", new Date().toISOString())
        .or("manual_moderation.is.null,manual_moderation.eq.false")
        .order("created_at", { ascending: false })
        .limit(22);

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
        .from("public_eggplants")
        .select("*")
        .lt("created_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(22);

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
      className={`min-h-screen h-full overflow-auto flex flex-col items-center justify-start relative ${rubikDoodleShadow.className}`}
      style={{
        background: "#fffff3",
      }}
    >
      <h1 className="text-2xl md:text-4xl font-bold py-4 md:py-10 text-green-800">
        Anna&apos;s Secret Garden
      </h1>

      {/* Island background */}
      <div className="z-10 flex md:gap-20 pb-10 px-4 gap-10 flex-col md:flex-row w-full h-full justify-center items-center flex-1">
        <div style={{ animation: "bob 3s ease-in-out infinite" }}>
          <img
            src="/island.png"
            alt="Garden island"
            className="flex-1 max-w-full w-[600px]"
          />

          {/* Flowers positioned on the island */}
          {!loading &&
            !error &&
            (plantType === "flowers" ? flowers : eggplants).map(
              (flower, index) => {
                const position =
                  flowerPositions[flowerPositions.length - index - 1];
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

        <div className="hidden md:block">
          <DrawFlower
            plantType={plantType}
            displayedCaption={displayedCaption}
            isTyping={isTyping}
            canvasRef={canvasRef as React.RefObject<CanvasRef>}
            isAnalyzing={isAnalyzing}
            saveDrawing={saveDrawing}
            onClickBackToGarden={() => {
              setPlantType("flowers");
              setCaption("Add a flower to our garden? ");
              setDisplayedCaption("");
            }}
          />
        </div>

        {/* Canvas Overlay for mobile */}
        {showCanvasOverlay && (
          <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="rounded-lg bg-[#fffff3] p-6 w-full h-full relative flex flex-col justify-center items-center gap-6">
              {/* Close button */}
              <button
                onClick={() => setShowCanvasOverlay(false)}
                className="absolute top-2 right-2 w-12 h-12 text-gray-600 hover:text-black cursor-pointer rounded-full text-3xl hover:text-4xl flex items-center justify-center"
              >
                ×
              </button>
              <div className="flex flex-row gap-2">
                {flowers.slice(0, 5).map((flower) => (
                  <img
                    key={flower.id}
                    src={flower.image_url}
                    alt={`Flower ${flower.id}`}
                    className="w-12 h-12 "
                  />
                ))}
              </div>
              <DrawFlower
                orientation="vertical"
                plantType={plantType}
                displayedCaption={displayedCaption}
                isTyping={isTyping}
                canvasRef={canvasRef as React.RefObject<CanvasRef>}
                isAnalyzing={isAnalyzing}
                saveDrawing={saveDrawing}
                onClickBackToGarden={() => {
                  setShowCanvasOverlay(false);
                  setPlantType("flowers");
                  setCaption("Add a flower to our garden? ");
                  setDisplayedCaption("");
                }}
              />

              <div className="flex flex-row gap-2">
                {flowers.slice(5, 10).map((flower) => (
                  <img
                    key={flower.id}
                    src={flower.image_url}
                    alt={`Flower ${flower.id}`}
                    className="w-12 h-12 "
                  />
                ))}
              </div>
            </div>
          </div>
        )}
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
      `}</style>

      {/* Mobile "Draw a flower" button - visible only on small screens */}
      <button
        onClick={() => setShowCanvasOverlay(true)}
        className="md:hidden py-3 px-6 bg-green-800 mb-2 cursor-pointer text-white rounded-full text-lg shadow-lg hover:bg-green-700 transition-colors font-medium"
      >
        🌸 Draw a flower
      </button>

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
        className="md:fixed md:bottom-8 visible right-8 mb-10 md:mb-0 py-3 px-3 flex items-center justify-center rounded-full text-lg border border-green-800 shadow-md hover:scale-110 text-green-800 transition-transform md:z-50"
        title="View Gallery"
      >
        🖼️ See flower gallery
      </a>
    </div>
  );
}
