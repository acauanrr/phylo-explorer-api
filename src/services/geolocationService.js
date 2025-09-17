import OpenCage from 'opencage-api-client';
import dotenv from 'dotenv';

dotenv.config();

const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;

if (!OPENCAGE_API_KEY || OPENCAGE_API_KEY === 'your_api_key_here') {
    console.warn('⚠️ OPENCAGE_API_KEY not configured. Geocoding will return mock data.');
}

class GeolocationService {
    constructor() {
        this.initialized = !!OPENCAGE_API_KEY && OPENCAGE_API_KEY !== 'your_api_key_here';
        this.mockLocations = {
            'New York': { lat: 40.7127281, lon: -74.0060152, country: 'United States', country_code: 'USA' },
            'Los Angeles': { lat: 34.0522265, lon: -118.2436596, country: 'United States', country_code: 'USA' },
            'London': { lat: 51.5073219, lon: -0.1276474, country: 'United Kingdom', country_code: 'GBR' },
            'Paris': { lat: 48.8566969, lon: 2.3514616, country: 'France', country_code: 'FRA' },
            'Tokyo': { lat: 35.6828387, lon: 139.7594549, country: 'Japan', country_code: 'JPN' },
            'Germany': { lat: 51.0834196, lon: 10.4234469, country: 'Germany', country_code: 'DEU' },
            'Greece': { lat: 39.074208, lon: 21.824312, country: 'Greece', country_code: 'GRC' },
            'Greek': { lat: 39.074208, lon: 21.824312, country: 'Greece', country_code: 'GRC' },
            'San Francisco': { lat: 37.7790262, lon: -122.4199061, country: 'United States', country_code: 'USA' },
            'Chicago': { lat: 41.8755616, lon: -87.6244212, country: 'United States', country_code: 'USA' },
            'Boston': { lat: 42.3554334, lon: -71.060511, country: 'United States', country_code: 'USA' },
            'Manhattan': { lat: 40.7831, lon: -73.9712, country: 'United States', country_code: 'USA' },
            'France': { lat: 46.227638, lon: 2.213749, country: 'France', country_code: 'FRA' },
            'Japan': { lat: 36.5748441, lon: 139.2394179, country: 'Japan', country_code: 'JPN' }
        };
    }

    /**
     * Get geographic data for a location name using OpenCage API
     * @param {string} locationName - Name of the location to geocode
     * @returns {Promise<Object|null>} Geographic data or null if not found
     */
    async getGeoData(locationName) {
        if (!locationName || typeof locationName !== 'string') {
            return null;
        }

        const cleanLocationName = locationName.trim();

        try {
            if (!this.initialized) {
                // Return mock data if API key is not configured
                console.log(`🗺️ Using mock geocoding for: ${cleanLocationName}`);
                return this.getMockGeoData(cleanLocationName);
            }

            console.log(`🌍 Geocoding location: ${cleanLocationName}`);

            const response = await OpenCage.geocode({
                key: OPENCAGE_API_KEY,
                q: cleanLocationName,
                language: 'en',
                limit: 1,
                no_annotations: 1 // Reduce response size
            });

            if (response.status.code === 200 && response.results && response.results.length > 0) {
                const result = response.results[0];
                const components = result.components || {};

                const geoData = {
                    query: cleanLocationName,
                    formatted: result.formatted,
                    country: components.country || '',
                    country_code: components['ISO_3166-1_alpha-3'] || components.country_code || '',
                    lat: result.geometry.lat,
                    lon: result.geometry.lng,
                    confidence: result.confidence || 0,
                    type: components._type || 'unknown'
                };

                console.log(`✅ Successfully geocoded ${cleanLocationName}: ${geoData.lat}, ${geoData.lon}`);
                return geoData;
            } else {
                console.log(`❌ No results found for: ${cleanLocationName}`);
                return null;
            }
        } catch (error) {
            console.error(`🚨 Geocoding error for ${cleanLocationName}:`, error.message);

            // Fallback to mock data on error
            console.log(`🔄 Falling back to mock data for: ${cleanLocationName}`);
            return this.getMockGeoData(cleanLocationName);
        }
    }

    /**
     * Get mock geographic data for testing/fallback
     * @param {string} locationName - Name of the location
     * @returns {Object|null} Mock geographic data or null
     */
    getMockGeoData(locationName) {
        const cleanName = locationName.trim();

        // Try exact match first
        if (this.mockLocations[cleanName]) {
            const mockData = this.mockLocations[cleanName];
            return {
                query: cleanName,
                formatted: `${cleanName}, ${mockData.country}`,
                country: mockData.country,
                country_code: mockData.country_code,
                lat: mockData.lat,
                lon: mockData.lon,
                confidence: 0.8,
                type: 'city',
                mock: true
            };
        }

        // Try partial matching for common variations
        const lowerName = cleanName.toLowerCase();
        for (const [key, value] of Object.entries(this.mockLocations)) {
            if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
                return {
                    query: cleanName,
                    formatted: `${key}, ${value.country}`,
                    country: value.country,
                    country_code: value.country_code,
                    lat: value.lat,
                    lon: value.lon,
                    confidence: 0.6,
                    type: 'city',
                    mock: true
                };
            }
        }

        console.log(`❌ No mock data found for: ${cleanName}`);
        return null;
    }

    /**
     * Batch geocode multiple locations
     * @param {string[]} locationNames - Array of location names
     * @returns {Promise<Object[]>} Array of geocoded results
     */
    async batchGeocode(locationNames) {
        if (!Array.isArray(locationNames)) {
            return [];
        }

        const results = [];

        for (const locationName of locationNames) {
            try {
                const geoData = await this.getGeoData(locationName);
                if (geoData) {
                    results.push(geoData);
                }

                // Add small delay to respect API rate limits
                if (this.initialized && locationNames.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`Error geocoding ${locationName}:`, error.message);
            }
        }

        return results;
    }

    /**
     * Check if the geocoding service is properly configured
     * @returns {boolean} True if API key is configured
     */
    isConfigured() {
        return this.initialized;
    }

    /**
     * Get service status information
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            configured: this.initialized,
            provider: 'OpenCage',
            mock_locations_available: Object.keys(this.mockLocations).length
        };
    }
}

// Export singleton instance
const geolocationService = new GeolocationService();
export default geolocationService;