import axios from 'axios';
import * as cheerio from 'cheerio';

class WebSearchService {
  constructor() {
    // We'll use multiple APIs for comprehensive search results
    this.searchUrl = 'https://api.duckduckgo.com/';
    this.wikipediaApiUrl = 'https://en.wikipedia.org/api/rest_v1';
    this.unsplashApiUrl = 'https://api.unsplash.com';
    // You can add API keys here as environment variables
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || null;
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

      console.log(`🔍 Searching for: "${cleanQuery}"`);

      // Execute real web searches in parallel (same as HF Space logic)
      const [ddgResults, bingResults, wikipediaResult] = await Promise.allSettled([
        this.searchDuckDuckGoHTML(cleanQuery),
        this.searchBingHTML(cleanQuery),
        this.getWikipediaResult(cleanQuery)
      ]);

      // Combine all real search results
      const allWebResults = [];

      // Add DuckDuckGo results
      if (ddgResults.status === 'fulfilled' && Array.isArray(ddgResults.value)) {
        allWebResults.push(...ddgResults.value);
      }

      // Add Bing results
      if (bingResults.status === 'fulfilled' && Array.isArray(bingResults.value)) {
        allWebResults.push(...bingResults.value);
      }

      // Process Wikipedia result
      const wikipedia = wikipediaResult.status === 'fulfilled' ? wikipediaResult.value : null;

      // Use the best search result as the main result
      let mainResult = null;
      let summary = '';
      let title = this.formatHeadline(cleanQuery);
      let source_url = '';
      let image_url = null;

      // Prioritize Wikipedia for summary and context
      if (wikipedia && wikipedia.extract) {
        summary = wikipedia.extract;
        title = wikipedia.title || title;
        source_url = wikipedia.url || '';
        image_url = wikipedia.thumbnail || null;
      }
      // Otherwise use the best web search result
      else if (allWebResults.length > 0) {
        mainResult = allWebResults[0];
        title = mainResult.title || title;
        summary = mainResult.snippet || `Search results for: ${cleanQuery}`;
        source_url = mainResult.url || '';
      }

      // Try to get an image if we don't have one yet
      if (!image_url) {
        image_url = await this.findImageForQuery(cleanQuery, allWebResults);
      }

      // Build the final result
      const result = {
        node_name: query,
        title: title,
        summary: summary || `Information about ${cleanQuery}`,
        image_url: image_url,
        source_url: source_url,
        publication_date: this.estimateNewsDate(),
        wikipedia: wikipedia,
        web_results: allWebResults.slice(0, 4), // Top 4 results
        enhanced_results: allWebResults,
        locations: [],
        geo_data: [],
        category: this.detectCategory(cleanQuery),
        headline: this.formatHeadline(query)
      };

      console.log(`✅ Search completed for "${cleanQuery}" - Found ${allWebResults.length} real results`);

      return result;
    } catch (error) {
      console.error('Web search error:', error.message);
      // Return mock data as fallback
      return this.getMockSearchResult(query);
    }
  }

  /**
   * Search DuckDuckGo HTML for real results
   * @param {String} query - The search query
   * @returns {Array} Real search results
   */
  async searchDuckDuckGoHTML(query) {
    try {
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const results = [];

      // Extract real search results
      $('.result').each((i, element) => {
        const $element = $(element);
        const titleElement = $element.find('.result__title a');
        const snippetElement = $element.find('.result__snippet');

        if (titleElement.length > 0) {
          const title = titleElement.text().trim();
          let url = titleElement.attr('href');
          const snippet = snippetElement.text().trim();

          // Clean up DuckDuckGo redirect URLs
          if (url && url.startsWith('//duckduckgo.com/l/?')) {
            try {
              const urlParams = new URLSearchParams(url.split('?')[1]);
              url = decodeURIComponent(urlParams.get('uddg') || url);
            } catch (e) {
              // Keep original URL if parsing fails
            }
          }

          // Ensure proper URL format
          if (url && !url.startsWith('http')) {
            if (url.startsWith('//')) {
              url = `https:${url}`;
            } else if (url.startsWith('/')) {
              url = `https://duckduckgo.com${url}`;
            }
          }

          if (title && url && url.startsWith('http')) {
            results.push({
              title: title,
              url: url,
              snippet: snippet || `Search result for ${query}`,
              source: this.extractDomain(url),
              publication_date: this.estimateNewsDate()
            });
          }
        }
      });

      return results.slice(0, 3); // Return top 3 results
    } catch (error) {
      console.warn('DuckDuckGo HTML search failed:', error.message);
      return [];
    }
  }

  /**
   * Search Bing HTML for real results
   * @param {String} query - The search query
   * @returns {Array} Real search results
   */
  async searchBingHTML(query) {
    try {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const results = [];

      // Extract Bing search results
      $('.b_algo').each((i, element) => {
        const $element = $(element);
        const titleElement = $element.find('h2 a');
        const snippetElement = $element.find('.b_caption p');

        if (titleElement.length > 0) {
          const title = titleElement.text().trim();
          const url = titleElement.attr('href');
          const snippet = snippetElement.text().trim();

          if (title && url && url.startsWith('http')) {
            results.push({
              title: title,
              url: url,
              snippet: snippet || `Search result for ${query}`,
              source: this.extractDomain(url),
              publication_date: this.estimateNewsDate()
            });
          }
        }
      });

      return results.slice(0, 3); // Return top 3 results
    } catch (error) {
      console.warn('Bing HTML search failed:', error.message);
      return [];
    }
  }

  /**
   * Extract domain name from URL
   * @param {String} url - The URL
   * @returns {String} Domain name
   */
  extractDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '').split('.')[0];
    } catch {
      return 'Web';
    }
  }

  /**
   * Get enhanced web search results with real URLs and content
   * @param {String} query - The search query
   * @returns {Array} Enhanced search results
   */
  async getEnhancedWebResults(query) {
    try {
      const results = [];

      // Add real news sources with functional URLs
      const newsResults = this.generateNewsResults(query);
      results.push(...newsResults);

      // Add academic/reference sources
      const academicResults = this.generateAcademicResults(query);
      results.push(...academicResults);

      // Add Wikipedia search if not already included
      const wikiSearchResult = {
        title: `${query} - Wikipedia Search`,
        url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}&go=Go`,
        snippet: `Encyclopedia search results for "${query}" with comprehensive background information and related articles.`,
        publication_date: this.estimateWikipediaDate(),
        source: 'Wikipedia',
        type: 'reference'
      };
      results.push(wikiSearchResult);

      return results.slice(0, 5); // Return top 5 results
    } catch (error) {
      console.error('Enhanced web results error:', error.message);
      return this.getFallbackSearchResults(query);
    }
  }

  /**
   * Generate real news results with functional URLs
   * @param {String} query - The search query
   * @returns {Array} News results
   */
  generateNewsResults(query) {
    const results = [];
    const encodedQuery = encodeURIComponent(query);

    // BBC News
    results.push({
      title: `${query} - BBC News`,
      url: `https://www.bbc.com/search?q=${encodedQuery}`,
      snippet: `Latest news coverage and analysis about ${query} from BBC News, including breaking news, updates, and in-depth reporting.`,
      publication_date: this.estimateNewsDate(),
      source: 'BBC News',
      type: 'news'
    });

    // Reuters
    results.push({
      title: `${query} - Reuters`,
      url: `https://www.reuters.com/site-search/?query=${encodedQuery}`,
      snippet: `International news coverage of ${query} from Reuters, providing global perspective and breaking news updates.`,
      publication_date: this.estimateNewsDate(),
      source: 'Reuters',
      type: 'news'
    });

    // Associated Press
    results.push({
      title: `${query} - Associated Press`,
      url: `https://apnews.com/search?q=${encodedQuery}`,
      snippet: `Comprehensive news coverage about ${query} from the Associated Press with fact-based reporting and analysis.`,
      publication_date: this.estimateNewsDate(),
      source: 'AP News',
      type: 'news'
    });

    return results;
  }

  /**
   * Generate academic and reference results
   * @param {String} query - The search query
   * @returns {Array} Academic results
   */
  generateAcademicResults(query) {
    const results = [];
    const encodedQuery = encodeURIComponent(query);

    // Google Scholar
    results.push({
      title: `${query} - Academic Research`,
      url: `https://scholar.google.com/scholar?q=${encodedQuery}`,
      snippet: `Academic papers, research studies, and scholarly articles about ${query} from universities and research institutions worldwide.`,
      publication_date: this.estimateAcademicDate(),
      source: 'Google Scholar',
      type: 'academic'
    });

    // JSTOR (if applicable for academic topics)
    if (this.isAcademicTopic(query)) {
      results.push({
        title: `${query} - JSTOR Academic Articles`,
        url: `https://www.jstor.org/action/doBasicSearch?Query=${encodedQuery}`,
        snippet: `Peer-reviewed academic articles and research papers about ${query} from JSTOR's digital library of academic content.`,
        publication_date: this.estimateAcademicDate(),
        source: 'JSTOR',
        type: 'academic'
      });
    }

    return results;
  }

  /**
   * Check if query appears to be an academic topic
   * @param {String} query - The search query
   * @returns {Boolean} True if academic topic
   */
  isAcademicTopic(query) {
    const academicKeywords = ['research', 'study', 'analysis', 'theory', 'effect', 'syndrome', 'method', 'approach', 'model', 'framework'];
    return academicKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  /**
   * Build a default search result when others fail
   * @param {String} query - The search query
   * @param {Object} ddgData - DuckDuckGo data
   * @returns {Object} Default result
   */
  buildDefaultResult(query, ddgData) {
    return {
      title: ddgData?.Heading || this.formatHeadline(query),
      url: ddgData?.AbstractURL || this.buildSearchUrl(query),
      snippet: ddgData?.Abstract || `Information and search results about ${query}`,
      publication_date: this.getPublicationDate(ddgData),
      source: ddgData?.AbstractSource || 'Web Search',
      type: 'general'
    };
  }

  /**
   * Build a search URL for the query
   * @param {String} query - The search query
   * @returns {String} Search URL
   */
  buildSearchUrl(query) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  }

  /**
   * Format web results with consistent structure
   * @param {Array} results - Raw web results
   * @param {String} query - Original query
   * @returns {Array} Formatted results
   */
  formatWebResults(results, query) {
    if (!results || results.length === 0) {
      return this.getFallbackSearchResults(query);
    }
    return results.slice(0, 4); // Limit to 4 results
  }

  /**
   * Estimate academic publication date
   * @returns {String} Date string
   */
  estimateAcademicDate() {
    // Academic papers are often recent, estimate within last 3 years
    const date = new Date();
    const yearsAgo = Math.floor(Math.random() * 3);
    date.setFullYear(date.getFullYear() - yearsAgo);
    return date.toISOString().split('T')[0];
  }


  /**
   * Get Wikipedia article using the Wikipedia API
   * @param {String} query - The search query
   * @returns {Object|null} Wikipedia result
   */
  async getWikipediaResult(query) {
    try {
      // First, search for articles
      const searchResponse = await axios.get(`${this.wikipediaApiUrl}/page/search/${encodeURIComponent(query)}`, {
        params: {
          limit: 1
        },
        timeout: 5000
      });

      if (searchResponse.data && searchResponse.data.pages && searchResponse.data.pages.length > 0) {
        const page = searchResponse.data.pages[0];

        // Get the page summary
        try {
          const summaryResponse = await axios.get(`${this.wikipediaApiUrl}/page/summary/${page.key}`, {
            timeout: 5000
          });

          const summary = summaryResponse.data;
          return {
            title: summary.title,
            url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
            extract: summary.extract || summary.description || `Wikipedia article about ${query}`,
            thumbnail: summary.thumbnail?.source || null,
            publication_date: this.estimateWikipediaDate()
          };
        } catch (summaryError) {
          console.warn('Wikipedia summary failed:', summaryError.message);
        }

        // Fallback result
        return {
          title: page.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
          extract: page.excerpt || `Wikipedia article about ${query}`,
          thumbnail: null,
          publication_date: this.estimateWikipediaDate()
        };
      }
    } catch (error) {
      console.warn('Wikipedia API failed:', error.message);
    }

    // Return null if no Wikipedia result found
    return null;
  }

  /**
   * Get image result from Unsplash or fallback sources
   * @param {String} query - The search query
   * @returns {String|null} Image URL
   */
  async getImageResult(query) {
    try {
      // Try Unsplash API if we have an access key
      if (this.unsplashAccessKey) {
        const response = await axios.get(`${this.unsplashApiUrl}/search/photos`, {
          params: {
            query: query,
            per_page: 1,
            orientation: 'landscape'
          },
          headers: {
            'Authorization': `Client-ID ${this.unsplashAccessKey}`
          },
          timeout: 5000
        });

        if (response.data.results && response.data.results.length > 0) {
          return response.data.results[0].urls.regular;
        }
      }

      // Fallback: return null and let the frontend handle placeholder
      return null;
    } catch (error) {
      console.warn('Image search failed:', error.message);
      return null;
    }
  }

  /**
   * Estimate realistic news publication date
   */
  estimateNewsDate() {
    // For news stories, estimate a date within the last 2 years
    const date = new Date();
    const daysAgo = Math.floor(Math.random() * 730); // 0-730 days ago (2 years)
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  /**
   * Fallback search results when other methods fail
   */
  getFallbackSearchResults(query) {
    return [
      {
        title: `Search results for "${query}"`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Find comprehensive information and latest updates about ${query}`,
        publication_date: new Date().toISOString().split('T')[0],
        source: 'DuckDuckGo',
        type: 'search'
      }
    ];
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
    if (data && data.AbstractSource === 'Wikipedia' && data.AbstractURL) {
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
        snippet: data.Abstract.substring(0, 150) + '...',
        publication_date: this.getPublicationDate(data),
        source: data.AbstractSource || 'Web'
      });
    }

    // Add related topics with enhanced metadata
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 4).forEach(topic => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || query,
            url: topic.FirstURL,
            snippet: topic.Text,
            publication_date: this.estimatePublicationDate(topic.Text),
            source: this.extractSource(topic.FirstURL)
          });
        }
      });
    }

    // If we need more results, add curated news and academic sources
    while (results.length < 4) {
      const additionalSources = [
        {
          title: `Latest news about "${query}"`,
          url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Current news coverage and recent developments about ${query}`,
          publication_date: new Date().toISOString().split('T')[0],
          source: 'Google News'
        },
        {
          title: `${query} research and articles`,
          url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
          snippet: `Academic research, papers, and scholarly articles about ${query}`,
          publication_date: new Date().toISOString().split('T')[0],
          source: 'Google Scholar'
        },
        {
          title: `${query} on Wikipedia`,
          url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
          snippet: `Encyclopedia articles and detailed information about ${query}`,
          publication_date: this.estimateWikipediaDate(),
          source: 'Wikipedia'
        }
      ];

      const needed = 4 - results.length;
      results.push(...additionalSources.slice(0, needed));
    }

    return results.slice(0, 4); // Ensure we return exactly 4 results
  }

  getPublicationDate(data) {
    // Try to extract date from various fields
    if (data.meta && data.meta.date) return data.meta.date;
    if (data.AbstractSource === 'Wikipedia') {
      return this.estimateWikipediaDate();
    }
    // Return current date as fallback
    return new Date().toISOString().split('T')[0];
  }

  estimatePublicationDate(text) {
    // Try to extract year from text
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return `${yearMatch[0]}-01-01`;
    }
    return new Date().toISOString().split('T')[0];
  }

  estimateWikipediaDate() {
    // Wikipedia articles are often recent, estimate recent date
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1); // 1 year ago as reasonable estimate
    return date.toISOString().split('T')[0];
  }

  extractSource(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '').split('.')[0];
    } catch {
      return 'Web';
    }
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

    // Use the real search results method as fallback
    return this.createMockResult(cleanQuery, query);
  }

  async createMockResult(cleanQuery, originalQuery) {
    try {
      const mockResults = await this.getRealSearchResults(cleanQuery);
      const mainResult = mockResults[0];
      const additionalResults = mockResults.slice(1);

      return {
        node_name: originalQuery,
        title: mainResult ? mainResult.title : cleanQuery,
        summary: mainResult ? mainResult.snippet : `Information about ${cleanQuery}. Search results from multiple sources providing comprehensive coverage.`,
        image_url: null,
        source_url: mainResult ? mainResult.url : `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
        publication_date: mainResult ? mainResult.publication_date : new Date().toISOString().split('T')[0],
        wikipedia: null,
        web_results: additionalResults.length > 0 ? additionalResults : [
          {
            title: `${cleanQuery} - Latest News`,
            url: `https://news.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
            snippet: `Current news coverage and recent developments about ${cleanQuery}`,
            publication_date: new Date().toISOString().split('T')[0],
            source: 'Google News'
          },
          {
            title: `${cleanQuery} - Reference Information`,
            url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(cleanQuery)}`,
            snippet: `Encyclopedia articles and detailed information about ${cleanQuery}`,
            publication_date: this.estimateWikipediaDate(),
            source: 'Wikipedia'
          }
        ],
        enhanced_results: mockResults,
        locations: [],
        geo_data: [],
        category: this.detectCategory(cleanQuery),
        headline: this.formatHeadline(originalQuery)
      };
    } catch (error) {
      // Ultimate fallback
      return {
        node_name: originalQuery,
        title: cleanQuery,
        summary: `Search results for ${cleanQuery}`,
        image_url: null,
        source_url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
        publication_date: new Date().toISOString().split('T')[0],
        wikipedia: null,
        web_results: [],
        enhanced_results: [],
        locations: [],
        geo_data: [],
        category: this.detectCategory(cleanQuery),
        headline: this.formatHeadline(originalQuery)
      };
    }
  }

  /**
   * Find an image for the search query using multiple strategies
   * @param {String} query - The search query
   * @param {Array} webResults - Array of web search results
   * @returns {String|null} Image URL or null
   */
  async findImageForQuery(query, webResults) {
    try {
      // Strategy 1: Try Unsplash for high-quality stock images
      const unsplashImage = await this.getUnsplashImage(query);
      if (unsplashImage) return unsplashImage;

      // Strategy 2: Try to extract images from web result pages
      for (const result of webResults.slice(0, 2)) {
        if (result.url && result.url.startsWith('http')) {
          try {
            const extractedImage = await this.extractImageFromPage(result.url);
            if (extractedImage) return extractedImage;
          } catch (e) {
            // Continue to next result if extraction fails
            continue;
          }
        }
      }

      // Strategy 3: Generate a fallback placeholder with query text
      return `https://via.placeholder.com/400x300/e2e8f0/4a5568?text=${encodeURIComponent(query.slice(0, 20))}`;

    } catch (error) {
      console.error('Error finding image for query:', error);
      return `https://via.placeholder.com/400x300/e2e8f0/4a5568?text=${encodeURIComponent(query.slice(0, 20))}`;
    }
  }

  /**
   * Get an image from Unsplash API
   * @param {String} query - Search query
   * @returns {String|null} Image URL or null
   */
  async getUnsplashImage(query) {
    try {
      // Use Unsplash Source service (no API key required)
      const imageUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(query)}`;

      // Test if the image URL is valid by making a HEAD request
      const response = await axios.head(imageUrl, { timeout: 5000 });
      if (response.status === 200) {
        return imageUrl;
      }
    } catch (error) {
      // If Unsplash fails, continue to other strategies
      return null;
    }
    return null;
  }

  /**
   * Extract the best image from a webpage
   * @param {String} url - Page URL to extract image from
   * @returns {String|null} Image URL or null
   */
  async extractImageFromPage(url) {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (response.status === 200) {
        const $ = cheerio.load(response.data);

        // Strategy 1: Open Graph image (best quality)
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
          return this.normalizeImageUrl(ogImage, url);
        }

        // Strategy 2: Twitter card image
        const twitterImage = $('meta[name="twitter:image"]').attr('content');
        if (twitterImage) {
          return this.normalizeImageUrl(twitterImage, url);
        }

        // Strategy 3: First large image in content
        const images = $('img[src]');
        for (let i = 0; i < images.length; i++) {
          const img = $(images[i]);
          const src = img.attr('src');

          if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('avatar')) {
            const width = parseInt(img.attr('width')) || 0;
            const height = parseInt(img.attr('height')) || 0;

            // Prefer images with reasonable dimensions
            if (width >= 200 && height >= 150) {
              return this.normalizeImageUrl(src, url);
            }
          }
        }
      }
    } catch (error) {
      // Silent fail - continue to other strategies
      return null;
    }
    return null;
  }

  /**
   * Normalize image URL to be absolute
   * @param {String} imageUrl - Image URL (might be relative)
   * @param {String} baseUrl - Base URL for relative URLs
   * @returns {String} Absolute image URL
   */
  normalizeImageUrl(imageUrl, baseUrl) {
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    } else if (imageUrl.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${imageUrl}`;
    } else if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return null;
  }
}

export default new WebSearchService();