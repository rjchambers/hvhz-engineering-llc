const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OFFICE_LAT = 26.1726;
const OFFICE_LNG = -80.1270;
const DISTANCE_THRESHOLD_MILES = 25;
const DISTANCE_FEE = 50;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobAddress, jobCity, jobZipCode } = await req.json();

    if (
      !jobAddress || jobAddress.length < 5 || jobAddress.length > 200 ||
      !jobCity || jobCity.length < 2 || jobCity.length > 100 ||
      !/^\d{5}$/.test(jobZipCode)
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("VITE_GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Geocoding not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullAddress = `${jobAddress}, ${jobCity}, FL ${jobZipCode}`;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    if (geoData.status !== "OK" || !geoData.results?.length) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not geocode address" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lat, lng } = geoData.results[0].geometry.location;
    const distanceMiles = haversineDistance(OFFICE_LAT, OFFICE_LNG, lat, lng);
    const feeApplies = distanceMiles >= DISTANCE_THRESHOLD_MILES;

    return new Response(
      JSON.stringify({
        success: true,
        distanceMiles: Math.round(distanceMiles * 10) / 10,
        feeApplies,
        fee: feeApplies ? DISTANCE_FEE : 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
