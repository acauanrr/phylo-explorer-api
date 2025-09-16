import axios from 'axios';

class WebSearchService {
  constructor() {
    // We'll use DuckDuckGo Instant Answer API as a free alternative
    this.searchUrl = 'https://api.duckduckgo.com/';
  }

  /**
   * Search for information about a query/node
   * @param {String} query - The search query
   * @returns {Object} Search results with web links, images, and locations
   */
  async search(query) {
    try {
      // Clean up the query
      const cleanQuery = this.cleanQuery(query);

      // Get DuckDuckGo instant answer
      const ddgResponse = await axios.get(this.searchUrl, {
        params: {
          q: cleanQuery,
          format: 'json',
          no_html: 1,
          skip_disambig: 1
        },
        timeout: 10000
      });

      const data = ddgResponse.data;

      // Extract location data from the response
      const locationData = this.extractLocations(data, cleanQuery);

      // Format the response
      const result = {
        node_name: query,
        title: data.Heading || cleanQuery,
        summary: this.getSummary(data),
        image_url: this.getImageUrl(data),
        source_url: data.AbstractURL || null,
        wikipedia: this.getWikipediaInfo(data),
        web_results: this.getWebResults(data, cleanQuery),
        locations: locationData.locations,
        geo_data: locationData.geo_data,
        category: this.detectCategory(cleanQuery),
        headline: this.formatHeadline(query)
      };

      return result;
    } catch (error) {
      console.error('Web search error:', error.message);
      // Return mock data as fallback
      return this.getMockSearchResult(query);
    }
  }

  cleanQuery(query) {
    // Remove special characters and clean up the query
    return query
      .replace(/_cluster\d*$/, '')
      .replace(/_mixed$/, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getSummary(data) {
    if (data.Abstract) return data.Abstract;
    if (data.Answer) return data.Answer;
    if (data.Definition) return data.Definition;
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const firstTopic = data.RelatedTopics[0];
      if (firstTopic.Text) return firstTopic.Text;
    }
    return null;
  }

  getImageUrl(data) {
    if (data.Image) {
      // DuckDuckGo returns relative URLs, need to make them absolute
      if (data.Image.startsWith('/')) {
        return `https://duckduckgo.com${data.Image}`;
      }
      return data.Image;
    }
    return null;
  }

  getWikipediaInfo(data) {
    if (data.AbstractSource === 'Wikipedia' && data.AbstractURL) {
      return {
        title: data.Heading || 'Wikipedia Article',
        url: data.AbstractURL,
        extract: data.Abstract
      };
    }
    return null;
  }

  getWebResults(data, query) {
    const results = [];

    // Add main result if available
    if (data.AbstractURL && data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract.substring(0, 150) + '...'
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 3).forEach(topic => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || query,
            url: topic.FirstURL,
            snippet: topic.Text
          });
        }
      });
    }

    // If no results, provide some default search links
    if (results.length === 0) {
      results.push(
        {
          title: `Search for "${query}" on Google`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Search Google for more information about ${query}`
        },
        {
          title: `Search for "${query}" on Wikipedia`,
          url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
          snippet: `Find Wikipedia articles about ${query}`
        }
      );
    }

    return results;
  }

  extractLocations(data, query) {
    const locations = [];
    const geo_data = [];

    // Common location patterns
    const locationPatterns = [
      /\b(United States|USA|US|America)\b/gi,
      /\b(United Kingdom|UK|Britain|England)\b/gi,
      /\b(China|Beijing|Shanghai)\b/gi,
      /\b(Russia|Moscow)\b/gi,
      /\b(Japan|Tokyo)\b/gi,
      /\b(Germany|Berlin)\b/gi,
      /\b(France|Paris)\b/gi,
      /\b(Italy|Rome)\b/gi,
      /\b(Spain|Madrid)\b/gi,
      /\b(Canada|Toronto|Vancouver)\b/gi,
      /\b(Australia|Sydney|Melbourne)\b/gi,
      /\b(Brazil|São Paulo|Rio)\b/gi,
      /\b(India|Delhi|Mumbai)\b/gi,
      /\b(Mexico|Mexico City)\b/gi,
      /\b(New York|Los Angeles|Chicago|Houston)\b/gi,
      /\b(London|Manchester|Birmingham)\b/gi,
    ];

    // Check in summary and query
    const textToCheck = `${data.Abstract || ''} ${data.Answer || ''} ${query}`;

    const locationMap = {
      'United States': { lat: 39.8283, lng: -98.5795, country: 'USA' },
      'United Kingdom': { lat: 55.3781, lng: -3.436, country: 'UK' },
      'China': { lat: 35.8617, lng: 104.1954, country: 'China' },
      'Russia': { lat: 61.524, lng: 105.3188, country: 'Russia' },
      'Japan': { lat: 36.2048, lng: 138.2529, country: 'Japan' },
      'Germany': { lat: 51.1657, lng: 10.4515, country: 'Germany' },
      'France': { lat: 46.6034, lng: 1.8883, country: 'France' },
      'Italy': { lat: 41.8719, lng: 12.5674, country: 'Italy' },
      'Spain': { lat: 40.4637, lng: -3.7492, country: 'Spain' },
      'Canada': { lat: 56.1304, lng: -106.3468, country: 'Canada' },
      'Australia': { lat: -25.2744, lng: 133.7751, country: 'Australia' },
      'Brazil': { lat: -14.235, lng: -51.9253, country: 'Brazil' },
      'India': { lat: 20.5937, lng: 78.9629, country: 'India' },
      'Mexico': { lat: 23.6345, lng: -102.5528, country: 'Mexico' },
      'New York': { lat: 40.7128, lng: -74.006, city: 'New York', country: 'USA' },
      'London': { lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
    };

    // Find matching locations
    for (const [location, coords] of Object.entries(locationMap)) {
      const regex = new RegExp(`\\b${location}\\b`, 'i');
      if (regex.test(textToCheck)) {
        locations.push(location);
        geo_data.push({
          name: location,
          ...coords,
          relevance: 1.0
        });
      }
    }

    return { locations, geo_data };
  }

  detectCategory(query) {
    const q = query.toLowerCase();
    if (q.includes('technology') || q.includes('tech') || q.includes('computer')) return 'Technology';
    if (q.includes('politics') || q.includes('election') || q.includes('government')) return 'Politics';
    if (q.includes('business') || q.includes('economy') || q.includes('finance')) return 'Business';
    if (q.includes('health') || q.includes('medical') || q.includes('disease')) return 'Health';
    if (q.includes('science') || q.includes('research') || q.includes('study')) return 'Science';
    if (q.includes('sports') || q.includes('game') || q.includes('team')) return 'Sports';
    if (q.includes('entertainment') || q.includes('movie') || q.includes('music')) return 'Entertainment';
    return 'General';
  }

  formatHeadline(query) {
    return query
      .replace(/_cluster\d*$/, '')
      .replace(/_mixed$/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getMockSearchResult(query) {
    const cleanQuery = this.cleanQuery(query);
    return {
      node_name: query,
      title: cleanQuery,
      summary: `This is information about ${cleanQuery}. The search service is currently unavailable, but this would normally show detailed information from web sources.`,
      image_url: null,
      source_url: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
      wikipedia: null,
      web_results: [
        {
          title: `Learn more about ${cleanQuery}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
          snippet: `Search for more information about ${cleanQuery} on Google`
        },
        {
          title: `${cleanQuery} on Wikipedia`,
          url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(cleanQuery)}`,
          snippet: `Find encyclopedia articles about ${cleanQuery}`
        },
        {
          title: `News about ${cleanQuery}`,
          url: `https://news.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
          snippet: `Latest news and updates about ${cleanQuery}`
        }
      ],
      locations: [],
      geo_data: [],
      category: this.detectCategory(cleanQuery),
      headline: this.formatHeadline(query)
    };
  }
}

export default new WebSearchService();