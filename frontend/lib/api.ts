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
  const res = await fetch(`${BACKEND_URL}/api/museum/validate?museum_id=${encodeURIComponent(museumId)}`);
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

export type SessionCreateResponse = {
  token: string;
  expires_in: number;
  redirect_url: string;
};

export type SessionValidateResponse = {
  valid: boolean;
  exhibit_id: string;
  museum_id: string;
  expires_in: number;
};

export async function createExhibitSession(exhibitId: string, museumId: string): Promise<SessionCreateResponse> {
  const res = await fetch(`${BACKEND_URL}/api/session/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exhibit_id: exhibitId,
      museum_id: museumId,
    }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function validateExhibitSession(token: string, exhibitId: string): Promise<SessionValidateResponse> {
  const url = `${BACKEND_URL}/api/session/validate?token=${encodeURIComponent(token)}&exhibit_id=${encodeURIComponent(exhibitId)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Invalid session token");
  return res.json();
}
