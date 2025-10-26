import { NextRequest, NextResponse } from "next/server";
import {
  saveMetadata,
  serverSupabase as supabase,
} from "../../../../lib/supabase-server";

export async function uploadImage(blob: Blob, filename: string) {
  try {
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("garden")
      .upload(filename, blob, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("garden").getPublicUrl(filename);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error("Error uploading to Supabase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    if (!formData) {
      return NextResponse.json(
        { error: "No form data provided" },
        { status: 400 }
      );
    }
    const imageBlob = formData.get("file") as Blob; // a Blob/File object
    if (!imageBlob) {
      throw new Error("invalid file");
    }

    const plantType = String(formData.get("plantType")) as
      | "flowers"
      | "eggplants";
    if (!plantType) {
      throw new Error("invalid plant type");
    }

    const probability = parseFloat(formData.get("probability") as string);
    if (!probability) {
      throw new Error("invalid probability");
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

    const fileName = `${plantType}-${Date.now()}.png`;

    const uploadResult = await uploadImage(imageBlob, fileName);

    if (uploadResult.success) {
      // Save metadata
      await saveMetadata(
        plantType,
        fileName,
        uploadResult.url!,
        probability,
        ip
      );
    }

    return NextResponse.json({
      url: uploadResult.url,
    });
  } catch (error) {
    console.error("Error saving or uploading image:", error);
    return NextResponse.json(
      {
        error: "Failed to save image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
