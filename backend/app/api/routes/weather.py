from typing import Optional
from fastapi import APIRouter, Query
from app.services.weather_service import weather_service
from app.schemas.weather import WeatherResponse

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    city: Optional[str] = Query("New York"),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
):
    """
    Fetch real-time weather from Open-Meteo with fallback support.
    Supports either city name geocoding or direct latitude/longitude coordinates.
    """
    return await weather_service.get_current_weather(
        city=city,
        latitude=latitude,
        longitude=longitude,
    )
