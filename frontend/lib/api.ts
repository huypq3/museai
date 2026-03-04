import { BACKEND_URL } from "./constants";

export async function getArtifact(artifactId: string) {
  const res = await fetch(`${BACKEND_URL}/artifacts/${artifactId}`);
  if (!res.ok) throw new Error("Failed to fetch artifact");
  return res.json();
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
