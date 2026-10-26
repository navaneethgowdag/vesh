from typing import Optional
from fastapi import APIRouter, Query
from app.services.weather_service import weather_service
from app.schemas.weather import WeatherResponse
from app.services.cache_service import cache_service, TTL_WEATHER

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    city: Optional[str] = Query("New York"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
):
    """
    Fetch real-time weather from Open-Meteo with selective Redis caching.
    Supports either city name geocoding or direct latitude/longitude coordinates.
    """
    if latitude is not None and longitude is not None:
        cache_id = f"geo_{latitude:.2f}_{longitude:.2f}"
    else:
        cache_id = f"city_{(city or 'new_york').strip().lower()}"

    cache_key = cache_service.build_key("weather", cache_id)

    cached = await cache_service.get_async(cache_key)
    if cached is not None:
        return cached

    fresh = await weather_service.get_current_weather(
        city=city,
        latitude=latitude,
        longitude=longitude,
    )
    data = fresh.model_dump() if hasattr(fresh, "model_dump") else fresh
    await cache_service.set_async(cache_key, data, ttl_seconds=TTL_WEATHER)
    return fresh

