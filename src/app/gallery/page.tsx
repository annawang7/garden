"use client";

import { useEffect, useState, useCallback } from "react";
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

const ITEMS_PER_PAGE = 200;

export default function Gallery() {
  const [flowers, setFlowers] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedFlowers, setLoadedFlowers] = useState<Set<number>>(new Set());

  const fetchFlowers = useCallback(
    async (page: number) => {
      setLoading(true);
      setLoadedFlowers(new Set()); // Reset loaded flowers for new page
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;

        // Fetch the flowers for this page
        const { data, error } = await supabase
          .from("public_flowers")
          .select("*")
          .lt("created_at", new Date().toISOString())
          .or("manual_moderation.is.null,manual_moderation.eq.false")
          .order("created_at", { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);

        if (error) {
          throw error;
        }

        // Fetch the total count (only on first load or when needed)
        if (totalCount === 0) {
          const { count, error: countError } = await supabase
            .from("public_flowers")
            .select("*", { count: "exact", head: true })
            .or("manual_moderation.is.null,manual_moderation.eq.false");

          if (countError) {
            console.error("Error fetching count:", countError);
          } else {
            setTotalCount(count || 0);
          }
        }

        setFlowers(data || []);
      } catch (err) {
        console.error("Error fetching flowers:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch flowers"
        );
      } finally {
        setLoading(false);
      }
    },
    [totalCount]
  );

  useEffect(() => {
    fetchFlowers(currentPage);
  }, [currentPage, fetchFlowers]);

  const handleImageLoad = (flowerId: number) => {
    setLoadedFlowers((prev) => new Set(prev).add(flowerId));
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
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
          <div className="mb-6 flex items-center justify-between">
            <p className="text-gray-600">{totalCount} total flowers</p>
          </div>
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
            {flowers.map((flower) => {
              const isLoaded = loadedFlowers.has(flower.id);
              return (
                <div
                  key={flower.id}
                  className={`relative aspect-square rounded-lg overflow-hidden group w-12 h-12 cursor-pointer ${
                    isLoaded ? "animate-growIn" : "opacity-0 scale-0"
                  }`}
                  onClick={() => console.log(flower.id)}
                  style={{
                    transformOrigin: "center bottom",
                  }}
                >
                  <img
                    src={flower.image_url}
                    alt={`Flower ${flower.id}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onLoad={() => handleImageLoad(flower.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && flowers.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-full border transition-all ${
                currentPage === 1
                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                  : "border-green-800 text-green-800 hover:bg-green-800 hover:text-white"
              }`}
            >
              ← Previous
            </button>
            <span className="text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-full border transition-all ${
                currentPage === totalPages
                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                  : "border-green-800 text-green-800 hover:bg-green-800 hover:text-white"
              }`}
            >
              Next →
            </button>
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
