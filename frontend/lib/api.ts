import { BACKEND_URL } from "./constants";

export type MuseumValidation = {
  id: string;
  name: string;
  name_en?: string;
  logo_url?: string;
  welcome_message?: Record<string, string>;
  supported_languages?: string[];
  default_language?: string;
  status?: string;
  theme?: Record<string, string>;
};

export async function getExhibit(exhibitId: string) {
  const res = await fetch(`${BACKEND_URL}/exhibits/${exhibitId}`);
  if (!res.ok) throw new Error("Failed to fetch exhibit");
  return res.json();
}


export async function validateMuseum(museumId: string): Promise<MuseumValidation> {
  const res = await fetch(`${BACKEND_URL}/museums/${encodeURIComponent(museumId)}/validate`);
  if (!res.ok) throw new Error("Museum validation failed");
  return res.json();
}

export async function validateExhibitMuseum(exhibitId: string, museumId: string) {
  const url = `${BACKEND_URL}/exhibits/${encodeURIComponent(exhibitId)}/validate?museum_id=${encodeURIComponent(museumId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Exhibit validation failed");
  return res.json();
}

export async function recognizeExhibit(museumId: string, imageFile: File) {
  const formData = new FormData();
  formData.append("file", imageFile);

  const res = await fetch(`${BACKEND_URL}/vision/recognize/${museumId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to recognize exhibit");
  return res.json();
}
