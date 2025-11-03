import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { supabase } from "../../../../lib/supabase";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const labels = [
  "a doodle of a flower",
  "a sketch of a flower",
  "artwork with flowers",
  "a doodle of a penis",
  "a doodle",
  "a doodle of an object",
  "a swastika",
  "handwriting",
  "text",
  "the word flower",
  "a swastika in a flower",
];

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: "No image data provided" },
        { status: 400 }
      );
    }

    // Extract IP address from request
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check if IP has exceeded the limit (10 flowers)
    const { count, error: countError } = await supabase
      .from("flowers")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip);

    if (countError) {
      console.error("Error checking IP count:", countError);
    } else if (count !== null && count >= 10) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "You've reached the maximum of 10 flowers. Thank you for contributing!",
          rateLimited: true,
          currentCount: count,
        },
        { status: 429 }
      );
    }

    // Use CLIP to classify the image
    const text = labels.join(" | ");
    const input = {
      text,
      image: imageData,
    };

    const output = await replicate.run(
      "cjwbw/clip-vit-large-patch14:566ab1f111e526640c5154e712d4d54961414278f89d36590f1425badc763ecb",
      { input }
    );

    // The output is an array of probabilities for each text option
    const probabilities = output as number[];

    // Check if it's likely a flower (first two options are flower-related)
    const flowerProbability =
      probabilities[0] + probabilities[1] + probabilities[2]; // Sum of flower-related probabilities
    const isFlower = flowerProbability > 0.9; // Threshold for considering it a flower

    const eggplantProbability = probabilities[3];

    const probabilityMap = Object.fromEntries(
      labels.map((label, index) => [label, (output as number[])[index]])
    );

    console.log(probabilityMap);

    return NextResponse.json({
      isFlower,
      flowerProbability,
      isEggplant: eggplantProbability > 0.95,
      eggplantProbability,
      ip,
    });
  } catch (error) {
    console.error("Error moderating image:", error);
    return NextResponse.json(
      {
        error: "Failed to moderate image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
