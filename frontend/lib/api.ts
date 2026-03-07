import { BACKEND_URL } from "./constants";

export async function getExhibit(exhibitId: string) {
  const res = await fetch(`${BACKEND_URL}/exhibits/${exhibitId}`);
  if (!res.ok) throw new Error("Failed to fetch exhibit");
  return res.json();
}

// Legacy alias
export async function getArtifact(artifactId: string) {
  return getExhibit(artifactId);
}

export async function recognizeArtifact(museumId: string, imageFile: File) {
  const formData = new FormData();
  formData.append("file", imageFile);
  
  const res = await fetch(`${BACKEND_URL}/vision/recognize/${museumId}`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) throw new Error("Failed to recognize artifact");
  return res.json();
}
