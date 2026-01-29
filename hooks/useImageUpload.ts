import { useState } from "react";

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        return data.data.url;
      }
      throw new Error("Upload failed");
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
};