import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadImage(imageBlob: Blob, filename: string) {
  try {
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("garden")
      .upload(filename, imageBlob, {
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

export async function saveMetadata(
  plantType: "flowers" | "eggplants",
  filename: string,
  url: string,
  confidence: number,
  ip?: string
) {
  try {
    let manual_moderation = undefined;
    if (ip === undefined || ["100.0.112.35", "174.224.191.189"].includes(ip)) {
      manual_moderation = true;
    }

    const { data, error } = await supabase.from(plantType).insert([
      {
        filename,
        image_url: url,
        confidence: confidence,
        ip_address: ip || "unknown",
        created_at: new Date().toISOString(),
        manual_moderation,
      },
    ]);

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error saving metadata:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
