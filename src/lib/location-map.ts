export async function fetchLocationMapBase64(
  lat: number,
  lng: number,
  apiKey: string,
  zoom: number = 18,
  size: string = '400x300'
): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/staticmap?`
    + `center=${lat},${lng}`
    + `&zoom=${zoom}`
    + `&size=${size}`
    + `&maptype=satellite`
    + `&markers=color:red%7C${lat},${lng}`
    + `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
