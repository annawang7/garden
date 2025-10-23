"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import { Walter_Turncoat } from "next/font/google";

const walterTurncoat = Walter_Turncoat({
  weight: "400",
  subsets: ["latin"],
});

interface Drawing {
  id: number;
  filename: string;
  image_url: string;
  confidence: number;
  created_at: string;
  manual_moderation?: boolean;
}

export default function Gallery() {
  const [flowers, setFlowers] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchAllFlowers();
  }, []);

  const fetchAllFlowers = async () => {
    try {
      const { data, error } = await supabase
        .from("flowers")
        .select("*")
        .or("manual_moderation.is.null,manual_moderation.eq.false")
        .order("created_at", { ascending: false });

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

  return (
    <div
      className={`min-h-screen p-8 ${walterTurncoat.className}`}
      style={{ background: "#fffff3" }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl text-green-800">Flower Gallery</h1>
          <Link
            href="/"
            className="text-green-800 hover:underline text-lg border border-green-800 px-4 py-2 rounded-full hover:scale-105 transition-transform"
          >
            ← Back to Garden
          </Link>
        </div>

        {/* Stats */}
        {!loading && (
          <p className="text-gray-600 mb-6">{flowers.length} total flowers</p>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">Loading flowers... 🌸</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error loading flowers</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Grid of flowers */}
        {!loading && !error && (
          <div className=" flex flex-wrap gap-4">
            {flowers.map((flower) => (
              <div
                key={flower.id}
                className="relative aspect-square rounded-lg overflow-hidden group w-12 h-12 cursor-pointer"
                onClick={() => console.log(flower.id)}
              >
                <img
                  src={flower.image_url}
                  alt={`Flower ${flower.id}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && flowers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">No flowers yet 🌱</p>
            <Link
              href="/"
              className="text-green-800 hover:underline mt-4 inline-block"
            >
              Start planting!
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
