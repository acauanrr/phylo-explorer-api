import axios from 'axios';
import * as cheerio from 'cheerio';

class EnhancedSearchService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Main search function that aggregates results from multiple sources
   */
  async search(query) {
    try {
      const cleanQuery = this.cleanQuery(query);

      // Parse the query to extract meaningful search terms
      const searchTerms = this.extractSearchTerms(cleanQuery);

      // Perform searches in parallel
      const [newsResults, webResults, wikiResults] = await Promise.allSettled([
        this.searchGoogleNews(searchTerms),
        this.searchBingWeb(searchTerms),
        this.searchWikipedia(searchTerms)
      ]);

      // Process and combine results
      const mainResult = this.selectMainResult(newsResults, webResults, wikiResults, cleanQuery);
      const relatedResults = this.selectRelatedResults(newsResults, webResults, wikiResults, mainResult);

      // Extract locations and metadata
      const locations = this.extractLocations(mainResult, relatedResults, cleanQuery);

      return {
        node_name: query,
        title: mainResult.title,
        url: mainResult.url,
        image_url: mainResult.image,
        summary: mainResult.summary,
        publication_date: mainResult.date,
        source: mainResult.source,
        category: this.detectCategory(cleanQuery),

        // Main result details
        main_article: {
          title: mainResult.title,
          url: mainResult.url,
          image: mainResult.image,
          summary: mainResult.summary,
          date: mainResult.date,
          source: mainResult.source,
          author: mainResult.author
        },

        // Related articles (at least 3)
        related_articles: relatedResults,

        // Location data
        locations: locations.names,
        geo_data: locations.coordinates,

        // Metadata
        search_query: searchTerms,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Enhanced search error:', error);
      return this.getFallbackResults(query);
    }
  }

  /**
   * Extract meaningful search terms from query
   */
  extractSearchTerms(query) {
    // Remove common prefixes and clean up
    let terms = query
      .replace(/^(WEDDINGS?|ENTERTAINMENT|POLITICS?|TECH(NOLOGY)?|BUSINESS|SPORTS?|WORLD(\sNEWS)?)\s+\d+\s*/i, '')
      .replace(/Celebrity Couples?/i, 'celebrity couples')
      .replace(/The Strange Ways?/i, '')
      .trim();

    // If still too long, take first meaningful part
    if (terms.length > 60) {
      const parts = terms.split(/[.!?]/);
      terms = parts[0].trim();
    }

    return terms || query;
  }

  /**
   * Search Google News for recent articles
   */
  async searchGoogleNews(query) {
    try {
      // Use Google News RSS feed
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

      const response = await axios.get(rssUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const results = [];

      $('item').each((i, elem) => {
        if (i >= 5) return; // Limit to 5 results

        const title = $(elem).find('title').text();
        const link = $(elem).find('link').text();
        const pubDate = $(elem).find('pubDate').text();
        const description = $(elem).find('description').text();
        const source = $(elem).find('source').text();

        results.push({
          title: this.cleanTitle(title),
          url: link,
          summary: this.cleanDescription(description),
          date: this.parseDate(pubDate),
          source: source || 'Google News',
          type: 'news'
        });
      });

      return results;
    } catch (error) {
      console.error('Google News search failed:', error.message);
      return [];
    }
  }

  /**
   * Search Bing for web results
   */
  async searchBingWeb(query) {
    try {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 5000
      });

      const $ = cheerio.load(response.data);
      const results = [];

      // Parse Bing search results
      $('.b_algo').each((i, elem) => {
        if (i >= 5) return;

        const titleElem = $(elem).find('h2 a');
        const title = titleElem.text();
        const url = titleElem.attr('href');
        const snippet = $(elem).find('.b_caption p').text();

        // Try to extract date if available
        const dateMatch = snippet.match(/(\d{1,2}[\s,]+\w+[\s,]+\d{4})|(\w+\s+\d{1,2},?\s+\d{4})/);

        if (title && url) {
          results.push({
            title: this.cleanTitle(title),
            url: url,
            summary: snippet || '',
            date: dateMatch ? this.parseDate(dateMatch[0]) : null,
            source: new URL(url).hostname.replace('www.', ''),
            type: 'web'
          });
        }
      });

      return results;
    } catch (error) {
      console.error('Bing search failed:', error.message);
      return [];
    }
  }

  /**
   * Search Wikipedia for encyclopedic content
   */
  async searchWikipedia(query) {
    try {
      const apiUrl = `https://en.wikipedia.org/w/api.php`;

      // First, search for the page
      const searchResponse = await axios.get(apiUrl, {
        params: {
          action: 'opensearch',
          search: query,
          limit: 3,
          format: 'json'
        },
        timeout: 5000
      });

      const titles = searchResponse.data[1] || [];
      const urls = searchResponse.data[3] || [];

      if (titles.length === 0) return [];

      // Get page summaries
      const results = [];
      for (let i = 0; i < Math.min(titles.length, 3); i++) {
        try {
          const summaryResponse = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[i])}`,
            { timeout: 3000 }
          );

          const data = summaryResponse.data;
          results.push({
            title: data.title,
            url: urls[i] || data.content_urls?.desktop?.page,
            summary: data.extract,
            image: data.thumbnail?.source,
            date: null,
            source: 'Wikipedia',
            type: 'encyclopedia'
          });
        } catch (err) {
          console.error(`Wikipedia page fetch failed for ${titles[i]}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Wikipedia search failed:', error.message);
      return [];
    }
  }

  /**
   * Select the best main result from all searches
   */
  selectMainResult(newsResults, webResults, wikiResults, query) {
    const allResults = [
      ...(newsResults.status === 'fulfilled' ? newsResults.value : []),
      ...(webResults.status === 'fulfilled' ? webResults.value : []),
      ...(wikiResults.status === 'fulfilled' ? wikiResults.value : [])
    ];

    if (allResults.length === 0) {
      return this.createDefaultResult(query);
    }

    // Prioritize news results with images and dates
    const newsWithImage = allResults.find(r => r.type === 'news' && r.image);
    if (newsWithImage) return newsWithImage;

    // Then any news result
    const anyNews = allResults.find(r => r.type === 'news');
    if (anyNews) return anyNews;

    // Then Wikipedia with image
    const wikiWithImage = allResults.find(r => r.type === 'encyclopedia' && r.image);
    if (wikiWithImage) return wikiWithImage;

    // Default to first result
    return allResults[0];
  }

  /**
   * Select related results, avoiding duplicates
   */
  selectRelatedResults(newsResults, webResults, wikiResults, mainResult) {
    const allResults = [
      ...(newsResults.status === 'fulfilled' ? newsResults.value : []),
      ...(webResults.status === 'fulfilled' ? webResults.value : []),
      ...(wikiResults.status === 'fulfilled' ? wikiResults.value : [])
    ];

    // Filter out the main result and duplicates
    const related = allResults.filter(r =>
      r.url !== mainResult.url &&
      r.title !== mainResult.title
    );

    // Sort by relevance (prefer results with dates and summaries)
    related.sort((a, b) => {
      const scoreA = (a.date ? 2 : 0) + (a.summary ? 1 : 0) + (a.image ? 1 : 0);
      const scoreB = (b.date ? 2 : 0) + (b.summary ? 1 : 0) + (b.image ? 1 : 0);
      return scoreB - scoreA;
    });

    // Return at least 3 results, pad with generated links if necessary
    const results = related.slice(0, 4);

    while (results.length < 3) {
      results.push(this.generateSearchLink(mainResult.title || this.cleanQuery(mainResult.title), results.length));
    }

    return results;
  }

  /**
   * Clean and format query
   */
  cleanQuery(query) {
    return query
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clean title text
   */
  cleanTitle(title) {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[|\-–—]\s*.*$/, '') // Remove site names after separators
      .trim();
  }

  /**
   * Clean description/summary text
   */
  cleanDescription(desc) {
    // Remove HTML entities and extra spaces
    return desc
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse various date formats
   */
  parseDate(dateStr) {
    if (!dateStr) return null;

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      }
    } catch (e) {
      // Try manual parsing for common formats
      const patterns = [
        /(\d{1,2})[\s,]+(\w+)[\s,]+(\d{4})/,  // 15 January 2024
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,       // January 15, 2024
      ];

      for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
          try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
            }
          } catch (e) {
            // Continue to next pattern
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract location information
   */
  extractLocations(mainResult, relatedResults, query) {
    const locations = { names: [], coordinates: [] };

    // Combine all text for location extraction
    const allText = `${query} ${mainResult.title} ${mainResult.summary} ${relatedResults.map(r => r.title).join(' ')}`;

    const locationDatabase = {
      // Countries
      'United States': { lat: 39.8283, lng: -98.5795, type: 'country' },
      'USA': { lat: 39.8283, lng: -98.5795, type: 'country' },
      'UK': { lat: 55.3781, lng: -3.436, type: 'country' },
      'United Kingdom': { lat: 55.3781, lng: -3.436, type: 'country' },
      'China': { lat: 35.8617, lng: 104.1954, type: 'country' },
      'Japan': { lat: 36.2048, lng: 138.2529, type: 'country' },
      'Germany': { lat: 51.1657, lng: 10.4515, type: 'country' },
      'France': { lat: 46.6034, lng: 1.8883, type: 'country' },
      'Italy': { lat: 41.8719, lng: 12.5674, type: 'country' },
      'Spain': { lat: 40.4637, lng: -3.7492, type: 'country' },
      'Canada': { lat: 56.1304, lng: -106.3468, type: 'country' },
      'Australia': { lat: -25.2744, lng: 133.7751, type: 'country' },
      'Brazil': { lat: -14.235, lng: -51.9253, type: 'country' },
      'India': { lat: 20.5937, lng: 78.9629, type: 'country' },
      'Russia': { lat: 61.524, lng: 105.3188, type: 'country' },

      // Major Cities
      'New York': { lat: 40.7128, lng: -74.006, type: 'city', country: 'USA' },
      'Los Angeles': { lat: 34.0522, lng: -118.2437, type: 'city', country: 'USA' },
      'Chicago': { lat: 41.8781, lng: -87.6298, type: 'city', country: 'USA' },
      'London': { lat: 51.5074, lng: -0.1278, type: 'city', country: 'UK' },
      'Paris': { lat: 48.8566, lng: 2.3522, type: 'city', country: 'France' },
      'Tokyo': { lat: 35.6762, lng: 139.6503, type: 'city', country: 'Japan' },
      'Beijing': { lat: 39.9042, lng: 116.4074, type: 'city', country: 'China' },
      'Moscow': { lat: 55.7558, lng: 37.6173, type: 'city', country: 'Russia' },
      'Berlin': { lat: 52.52, lng: 13.405, type: 'city', country: 'Germany' },
      'Sydney': { lat: -33.8688, lng: 151.2093, type: 'city', country: 'Australia' },
      'Mumbai': { lat: 19.076, lng: 72.8777, type: 'city', country: 'India' },
      'Dubai': { lat: 25.2048, lng: 55.2708, type: 'city', country: 'UAE' },
      'Singapore': { lat: 1.3521, lng: 103.8198, type: 'city', country: 'Singapore' },
      'Hong Kong': { lat: 22.3193, lng: 114.1694, type: 'city', country: 'China' },
    };

    const foundLocations = new Set();

    for (const [location, data] of Object.entries(locationDatabase)) {
      const regex = new RegExp(`\\b${location}\\b`, 'i');
      if (regex.test(allText) && !foundLocations.has(location)) {
        locations.names.push(location);
        locations.coordinates.push({
          name: location,
          ...data,
          relevance: 1.0
        });
        foundLocations.add(location);
      }
    }

    return locations;
  }

  /**
   * Detect content category
   */
  detectCategory(query) {
    const q = query.toLowerCase();

    const categories = {
      'Entertainment': ['celebrity', 'movie', 'film', 'music', 'actor', 'actress', 'singer', 'wedding', 'couples'],
      'Technology': ['tech', 'software', 'app', 'computer', 'ai', 'robot', 'digital', 'internet'],
      'Politics': ['politics', 'election', 'president', 'government', 'policy', 'vote', 'congress'],
      'Business': ['business', 'company', 'market', 'stock', 'economy', 'finance', 'startup'],
      'Sports': ['sports', 'game', 'team', 'player', 'football', 'basketball', 'soccer', 'baseball'],
      'Health': ['health', 'medical', 'doctor', 'hospital', 'disease', 'treatment', 'covid'],
      'Science': ['science', 'research', 'study', 'discover', 'space', 'nasa', 'climate'],
      'World': ['world', 'international', 'global', 'country', 'nation', 'foreign'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => q.includes(keyword))) {
        return category;
      }
    }

    return 'General';
  }

  /**
   * Create a default result when no search results found
   */
  createDefaultResult(query) {
    return {
      title: this.cleanQuery(query),
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      summary: `Search for information about ${this.cleanQuery(query)}`,
      image: null,
      date: null,
      source: 'Web Search',
      type: 'web'
    };
  }

  /**
   * Generate a search link as fallback
   */
  generateSearchLink(query, index) {
    const searchEngines = [
      { name: 'Google News', url: `https://news.google.com/search?q=${encodeURIComponent(query)}` },
      { name: 'Bing News', url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}` },
      { name: 'Yahoo News', url: `https://news.search.yahoo.com/search?p=${encodeURIComponent(query)}` },
      { name: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}` },
    ];

    const engine = searchEngines[index % searchEngines.length];
    return {
      title: `Search ${engine.name} for "${query}"`,
      url: engine.url,
      summary: `Find more news and information about ${query}`,
      date: null,
      source: engine.name,
      type: 'search'
    };
  }

  /**
   * Get fallback results when search fails
   */
  getFallbackResults(query) {
    const cleanQuery = this.cleanQuery(query);
    const searchTerms = this.extractSearchTerms(cleanQuery);

    return {
      node_name: query,
      title: cleanQuery,
      url: `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`,
      image_url: null,
      summary: `Information about ${cleanQuery}`,
      publication_date: null,
      source: 'Web Search',
      category: this.detectCategory(cleanQuery),

      main_article: {
        title: cleanQuery,
        url: `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`,
        image: null,
        summary: `Search for information about ${cleanQuery}`,
        date: null,
        source: 'Google',
        author: null
      },

      related_articles: [
        this.generateSearchLink(searchTerms, 0),
        this.generateSearchLink(searchTerms, 1),
        this.generateSearchLink(searchTerms, 2),
      ],

      locations: [],
      geo_data: [],

      search_query: searchTerms,
      timestamp: new Date().toISOString()
    };
  }
}

export default new EnhancedSearchService();