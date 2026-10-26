from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.services.weather_service import weather_service
from app.schemas.weather import WeatherResponse
from app.services.cache_service import cache_service, TTL_WEATHER

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    city: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0),
):
    """
    Fetch real-time weather from Open-Meteo with selective Redis caching.
    Requires either latitude/longitude coordinates (reverse-geocoded to a real locality name)
    or a specific city name. Does NOT fallback to a hardcoded city.
    """
    if latitude is not None and longitude is not None:
        cache_id = f"geo_{latitude:.3f}_{longitude:.3f}"
    elif city and city.strip():
        cache_id = f"city_{city.strip().lower()}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location required. Please provide valid coordinates (latitude and longitude) or a city name.",
        )

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

