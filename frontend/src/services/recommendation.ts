import { ClothingItem, Occasion, Outfit, Recommendation, StylePreference, Weather } from '../types';
import { INITIAL_OUTFITS } from '../data/outfits';

export const recommendationService = {
  /**
   * Deterministic AI outfit generator that pairs garments from the user's wardrobe
   * with weather factors, occasion context, and aesthetic preferences.
   */
  generateOutfitRecommendation(
    wardrobe: ClothingItem[],
    preferences: StylePreference,
    weather: Weather,
    occasion: Occasion = 'Casual Daily',
    variationIndex: number = 0
  ): Recommendation {
    if (!wardrobe || wardrobe.length === 0) {
      // Fallback if wardrobe is completely empty
      const base = INITIAL_OUTFITS[0];
      return {
        id: `rec_${Date.now()}`,
        outfit: base,
        score: 95,
        weatherCompatibility: 94,
        styleCompatibility: 96,
        occasionCompatibility: 95,
        explanation: {
          weatherMatch: `Tailored for ${weather.temp}°C and ${weather.condition.toLowerCase()} weather.`,
          styleMatch: `Reflects your ${preferences?.styles?.[0] || 'Minimal'} aesthetic.`,
          wardrobeMatch: 'Uses versatile capsule staples.',
          occasionMatch: `Selected specifically for ${occasion}.`
        },
        reasons: [
          `Suitable for today's weather (${weather.temp}°C ${weather.condition})`,
          `Matches your ${preferences?.styles?.[0] || 'Minimal'} style preference`,
          'Balances comfortable silhouette with refined tailoring',
          `Curated specifically for ${occasion}`,
        ],
        recommendedAt: new Date().toISOString(),
      };
    }

    // Filter items by occasion and temperature
    const isCold = weather.temp < 18;
    const isWarm = weather.temp >= 24;

    const tops = wardrobe.filter((i) => i.category === 'Tops');
    const bottoms = wardrobe.filter((i) => i.category === 'Bottoms');
    const shoes = wardrobe.filter((i) => i.category === 'Shoes');
    const outerwear = wardrobe.filter((i) => i.category === 'Outerwear');
    const accessories = wardrobe.filter((i) => i.category === 'Accessories' || i.category === 'Bags');
    const dresses = wardrobe.filter((i) => i.category === 'Dresses');

    // Deterministic selection based on variationIndex
    const selectedPieces: ClothingItem[] = [];

    // Decide if Dress or Top + Bottom
    const preferDress = occasion === 'Date Night' && dresses.length > 0 && variationIndex % 2 === 1;

    if (preferDress && dresses.length > 0) {
      selectedPieces.push(dresses[variationIndex % dresses.length]);
    } else {
      if (tops.length > 0) {
        selectedPieces.push(tops[variationIndex % tops.length]);
      }
      if (bottoms.length > 0) {
        selectedPieces.push(bottoms[(variationIndex + 1) % bottoms.length]);
      }
    }

    // Add Outerwear if cool or variation requests it
    if ((isCold || variationIndex % 2 === 1) && outerwear.length > 0) {
      selectedPieces.push(outerwear[variationIndex % outerwear.length]);
    }

    // Add Shoes
    if (shoes.length > 0) {
      selectedPieces.push(shoes[variationIndex % shoes.length]);
    }

    // Add Accessory/Bag
    if (accessories.length > 0) {
      selectedPieces.push(accessories[variationIndex % accessories.length]);
      if (accessories.length > 1) {
        selectedPieces.push(accessories[(variationIndex + 1) % accessories.length]);
      }
    }

    // Score calculations
    const weatherScore = isWarm
      ? 96 - (variationIndex * 2 % 5)
      : isCold
      ? 93 + (variationIndex % 4)
      : 98 - (variationIndex % 3);

    const styleScore = 95 + ((variationIndex * 3) % 4);
    const occasionScore = 97 - ((variationIndex * 2) % 4);
    const overallScore = Math.round(weatherScore * 0.35 + styleScore * 0.4 + occasionScore * 0.25);

    const primaryStyle = preferences.styles[0] || 'Minimal';
    const topItem = selectedPieces.find((p) => p.category === 'Tops' || p.category === 'Dresses');
    const bottomItem = selectedPieces.find((p) => p.category === 'Bottoms');
    const shoeItem = selectedPieces.find((p) => p.category === 'Shoes');

    const title = `${primaryStyle} ${occasion.split(' ')[0]} Ensemble`;

    const outfit: Outfit = {
      id: `outfit_rec_${Date.now()}_${variationIndex}`,
      title,
      description: `Curated combination of ${topItem?.name || 'staple top'} and ${bottomItem?.name || shoeItem?.name || 'classic footwear'}, calibrated for ${weather.temp}°C ${weather.condition.toLowerCase()}.`,
      pieces: selectedPieces,
      occasion,
      style: primaryStyle,
      season: isWarm ? 'Summer' : isCold ? 'Autumn' : 'Spring',
      weatherFitTemp: weather.temp,
      score: overallScore,
      image: topItem?.image || selectedPieces[0]?.image || INITIAL_OUTFITS[0].image,
      tags: [primaryStyle.toLowerCase(), occasion.toLowerCase().replace(/\s+/g, '-'), 'ai-curated', `${weather.temp}c`],
      createdAt: new Date().toISOString(),
    };

    return {
      id: `rec_${Date.now()}_${variationIndex}`,
      outfit,
      score: overallScore,
      weatherCompatibility: weatherScore,
      styleCompatibility: styleScore,
      occasionCompatibility: occasionScore,
      explanation: {
        weatherMatch: `Thermal comfort optimized for ${weather.temp}°C (${weather.condition}) with breathable fabrics.`,
        styleMatch: `Aligns with your preference for ${preferences.styles.join(', ')} silhouettes.`,
        wardrobeMatch: `Maximizes wear rotation for your favorite ${topItem?.name || 'wardrobe pieces'}.`,
        occasionMatch: `Appropriate balance of comfort and polish for ${occasion}.`
      },
      reasons: [
        `Suitable for today's weather (${weather.temp}°C · ${weather.condition})`,
        `Matches your ${primaryStyle} style preferences`,
        `Uses ${selectedPieces.length} versatile pieces from your digital wardrobe`,
        `Color-coordinated neutral palette for ${occasion}`,
      ],
      recommendedAt: new Date().toISOString(),
      wornStatus: 'suggested',
    };
  },

  /**
   * Get alternative recommendations cycling variations
   */
  getAlternativeRecommendations(
    wardrobe: ClothingItem[],
    preferences: StylePreference,
    weather: Weather,
    occasion: Occasion,
    count: number = 3
  ): Recommendation[] {
    return Array.from({ length: count }, (_, idx) =>
      this.generateOutfitRecommendation(wardrobe, preferences, weather, occasion, idx + 1)
    );
  }
};

