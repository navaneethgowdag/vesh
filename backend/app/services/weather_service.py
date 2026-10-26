import logging
from typing import Dict, Any, Optional, Tuple
import httpx
from fastapi import HTTPException, status
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

WMO_WEATHER_CODES = {
    0: ("Sunny", "sun", "Clear blue skies. Perfect weather for showcasing your style."),
    1: ("Partly Cloudy", "cloud-sun", "Mainly clear with mild sun. Lightweight layers ideal."),
    2: ("Partly Cloudy", "cloud-sun", "Scattered clouds with pleasant ambient light."),
    3: ("Cloudy", "cloud", "Overcast skies. Soft diffused light; chic monochrome tones look great."),
    45: ("Foggy", "cloud", "Misty and foggy atmosphere. Cozy knitwear recommended."),
    48: ("Foggy", "cloud", "Depositing rime fog. Layer up with a warm structured coat."),
    51: ("Light Rain", "cloud-rain", "Light drizzle in the air. Water-resistant outerwear recommended."),
    53: ("Light Rain", "cloud-rain", "Moderate drizzle. A classic trench coat will keep you stylish."),
    55: ("Light Rain", "cloud-rain", "Dense drizzle. Bring an umbrella and sturdy leather shoes."),
    56: ("Light Rain", "cloud-rain", "Freezing drizzle. Thermal layers and weatherproof boots advised."),
    57: ("Light Rain", "cloud-rain", "Heavy freezing drizzle. Insulated water-repellent jacket recommended."),
    61: ("Light Rain", "cloud-rain", "Slight rain. Stylish rain jacket or trench coat is ideal."),
    63: ("Light Rain", "cloud-rain", "Steady rain showers. Layer a waterproof shell and boots."),
    65: ("Light Rain", "cloud-rain", "Heavy rainfall. Full rainwear and protective footwear essential."),
    66: ("Light Rain", "cloud-rain", "Freezing rain. Keep warm and dry with waterproof outer layers."),
    67: ("Light Rain", "cloud-rain", "Heavy freezing rain. Heavy winter coat and non-slip boots required."),
    71: ("Snow", "cloud-snow", "Slight snowfall. Warm wool coats, scarves, and boots are perfect."),
    73: ("Snow", "cloud-snow", "Moderate snowfall. Insulated outerwear and winter essentials."),
    75: ("Snow", "cloud-snow", "Heavy snowfall. Substantial winter parka and thermal layers required."),
    77: ("Snow", "cloud-snow", "Snow grains falling. Crisp winter aesthetic with cozy knitwear."),
    80: ("Light Rain", "cloud-rain", "Passing rain showers. Quick-drying fabrics and light jackets."),
    81: ("Light Rain", "cloud-rain", "Moderate showers. Pair waterproof outerwear with durable pants."),
    82: ("Light Rain", "cloud-rain", "Violent rain showers. Stay covered with heavy rainproof gear."),
    85: ("Snow", "cloud-snow", "Slight snow showers. Wool blend overcoats and stylish beanies."),
    86: ("Snow", "cloud-snow", "Heavy snow showers. Thick winter down jacket and insulated boots."),
    95: ("Thunderstorm", "cloud-lightning", "Thunderstorm active. Sturdy weather-resistant attire."),
    96: ("Thunderstorm", "cloud-lightning", "Thunderstorm with hail. Protective and durable layers recommended."),
    99: ("Thunderstorm", "cloud-lightning", "Severe thunderstorm with heavy hail. Stay indoors or dress warmly."),
}


class WeatherService:
    def __init__(self):
        self.geocoding_url = "https://geocoding-api.open-meteo.com/v1/search"
        self.forecast_url = "https://api.open-meteo.com/v1/forecast"

    async def geocode_city(self, city: str) -> Optional[Tuple[float, float, str, str]]:
        """
        Geocode city name to (lat, lon, resolved_city, country) via Open-Meteo Geocoding API.
        Pure live lookup with zero static mock tables.
        """
        clean_name = city.strip()
        if not clean_name:
            return None

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    self.geocoding_url,
                    params={"name": clean_name, "count": 1, "language": "en", "format": "json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results")
                    if results and len(results) > 0:
                        first = results[0]
                        return (
                            float(first["latitude"]),
                            float(first["longitude"]),
                            first.get("name", clean_name),
                            first.get("country_code", first.get("country", "")).upper(),
                        )
        except Exception as e:
            logger.warning(f"Open-Meteo geocoding error for city '{city}': {e}")

        return None

    async def reverse_geocode(self, lat: float, lon: float) -> Tuple[str, str]:
        """
        Resolve real city and country from GPS latitude and longitude.
        Uses BigDataCloud and Nominatim reverse geocoding services.
        """
        # 1. Try BigDataCloud free client reverse geocoding
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    "https://api.bigdatacloud.net/data/reverse-geocode-client",
                    params={"latitude": lat, "longitude": lon, "localityLanguage": "en"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    city = (
                        data.get("city")
                        or data.get("locality")
                        or data.get("principalSubdivision")
                        or f"{lat:.2f}, {lon:.2f}"
                    )
                    country = data.get("countryCode") or data.get("countryName") or ""
                    return city, country.upper()
        except Exception as e:
            logger.warning(f"BigDataCloud reverse geocode error for ({lat}, {lon}): {e}")

        # 2. Try OpenStreetMap Nominatim
        try:
            async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "StyleSphereApp/1.0"}) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    address = data.get("address", {})
                    city = (
                        address.get("city")
                        or address.get("town")
                        or address.get("village")
                        or address.get("suburb")
                        or address.get("county")
                        or f"{lat:.2f}, {lon:.2f}"
                    )
                    country = address.get("country_code", "").upper()
                    return city, country
        except Exception as e:
            logger.warning(f"Nominatim reverse geocode error for ({lat}, {lon}): {e}")

        return f"{lat:.2f}, {lon:.2f}", ""

    async def get_current_weather(
        self,
        city: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Fetch real live weather from Open-Meteo API.
        Zero dummy/mock data used.
        """
        lat = latitude
        lon = longitude
        resolved_city = city.strip() if city else ""
        resolved_country = ""

        # Case A: Live GPS coordinates supplied
        if lat is not None and lon is not None:
            if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid coordinates: latitude must be in [-90, 90], longitude in [-180, 180]. Got ({lat}, {lon}).",
                )
            if not resolved_city or resolved_city.lower() in ("current location", "live location"):
                resolved_city, resolved_country = await self.reverse_geocode(lat, lon)

        # Case B: City name supplied
        elif resolved_city:
            geocoded = await self.geocode_city(resolved_city)
            if geocoded:
                lat, lon, resolved_city, resolved_country = geocoded
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"City '{resolved_city}' could not be located on the global weather grid.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Location coordinates or city name must be provided.",
            )

        # Query Open-Meteo Forecast API with real coordinates
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max",
                    "timezone": "auto",
                }
                resp = await client.get(self.forecast_url, params=params)
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Open-Meteo weather service is temporarily unavailable.",
                    )

                data = resp.json()
                current = data.get("current", {})
                daily = data.get("daily", {})

                temp = round(float(current.get("temperature_2m", 0.0)), 1)
                feels_like = round(float(current.get("apparent_temperature", temp)), 1)
                humidity = int(current.get("relative_humidity_2m", 0))
                w_code = int(current.get("weather_code", 0))
                wind_speed = round(float(current.get("wind_speed_10m", 0.0)), 1)
                precipitation = round(float(current.get("precipitation", 0.0)), 2)

                rain_prob = 0
                if daily.get("precipitation_probability_max") and daily["precipitation_probability_max"]:
                    rain_prob = int(daily["precipitation_probability_max"][0] or 0)
                elif precipitation > 0:
                    rain_prob = min(100, int(precipitation * 30))

                high_temp = temp
                if daily.get("temperature_2m_max") and daily["temperature_2m_max"] and daily["temperature_2m_max"][0] is not None:
                    high_temp = round(float(daily["temperature_2m_max"][0]), 1)

                low_temp = temp
                if daily.get("temperature_2m_min") and daily["temperature_2m_min"] and daily["temperature_2m_min"][0] is not None:
                    low_temp = round(float(daily["temperature_2m_min"][0]), 1)

                uv_index = 0.0
                if daily.get("uv_index_max") and daily["uv_index_max"] and daily["uv_index_max"][0] is not None:
                    uv_index = round(float(daily["uv_index_max"][0]), 1)

                cond_name, icon_name, default_summary = WMO_WEATHER_CODES.get(
                    w_code,
                    ("Partly Cloudy", "cloud-sun", f"Conditions in {resolved_city}."),
                )

                return {
                    "city": resolved_city,
                    "country": resolved_country,
                    "temp": temp,
                    "feels_like": feels_like,
                    "humidity": humidity,
                    "weather_condition": cond_name,
                    "condition": cond_name,
                    "icon": icon_name,
                    "rain_probability": rain_prob,
                    "precipitation": precipitation,
                    "wind_speed": wind_speed,
                    "uv_index": uv_index,
                    "high_temp": high_temp,
                    "low_temp": low_temp,
                    "latitude": lat,
                    "longitude": lon,
                    "summary": f"{cond_name} in {resolved_city}. {default_summary}",
                }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to query Open-Meteo weather API for ({lat}, {lon}): {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Live weather data is temporarily unreachable: {str(e)}",
            )


weather_service = WeatherService()
