from typing import Optional
from pydantic import BaseModel, Field


class WeatherResponse(BaseModel):
    city: str
    country: str = ""
    temp: float
    feels_like: float
    humidity: int
    weather_condition: str
    condition: str
    icon: str
    rain_probability: int = 0
    precipitation: float = 0.0
    wind_speed: float = 0.0
    uv_index: float = 0.0
    high_temp: float = 0.0
    low_temp: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    summary: str = ""
