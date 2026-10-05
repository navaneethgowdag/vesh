import { api } from './api';
import { Weather } from '../types';

export const POPULAR_CITIES = [
  'New York',
  'London',
  'Paris',
  'Milan',
  'Tokyo',
  'Los Angeles',
  'Berlin',
  'Sydney',
];

/**
 * Service for retrieving real weather via FastAPI / Open-Meteo.
 * Zero dummy/mock data used.
 */
export const weatherService = {
  async getWeather(city?: string, latitude?: number, longitude?: number): Promise<Weather> {
    return api.weather.getCurrent(city, latitude, longitude);
  },

  getAllCities(): string[] {
    return POPULAR_CITIES;
  },
};
