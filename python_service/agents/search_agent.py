"""
Lightweight search agent for fetching information about selected nodes/words
"""

import asyncio
import aiohttp
import logging
from typing import Dict, Optional, List
import json
import re
from urllib.parse import quote, urlencode
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class SearchAgent:
    """
    Lightweight agent for searching and summarizing information about topics
    """

    def __init__(self):
        self.session = None
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self.headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def search_bing(self, query: str, max_results: int = 3) -> List[Dict]:
        """
        Search using Bing's web scraping (no API key required)
        Returns real URLs
        """
        try:
            search_url = f"https://www.bing.com/search?q={quote(query)}"

            async with self.session.get(search_url, timeout=10) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')

                    results = []
                    # Find search result elements
                    for result in soup.find_all('li', class_='b_algo')[:max_results]:
                        link_elem = result.find('h2')
                        if link_elem and link_elem.find('a'):
                            link = link_elem.find('a')
                            snippet_elem = result.find('div', class_='b_caption')
                            snippet = ''
                            if snippet_elem and snippet_elem.find('p'):
                                snippet = snippet_elem.find('p').get_text(strip=True)

                            results.append({
                                'title': link.get_text(strip=True),
                                'url': link.get('href', ''),
                                'snippet': snippet
                            })

                    return results
        except Exception as e:
            logger.error(f"Bing search failed: {e}")

        return []

    async def search_google_programmatically(self, query: str, max_results: int = 3) -> List[Dict]:
        """
        Search Google programmatically (be careful with rate limits)
        Returns real URLs
        """
        try:
            params = {
                'q': query,
                'num': max_results
            }
            search_url = f"https://www.google.com/search?{urlencode(params)}"

            async with self.session.get(search_url, timeout=10) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')

                    results = []
                    # Google's structure changes, but try common selectors
                    for g in soup.find_all('div', class_='g')[:max_results]:
                        link = g.find('a')
                        title_elem = g.find('h3')
                        snippet_elem = g.find('span', class_='aCOpRe') or g.find('span', class_='st')

                        if link and title_elem:
                            url = link.get('href', '')
                            # Clean up Google's URL redirect
                            if url.startswith('/url?q='):
                                url = url.split('/url?q=')[1].split('&')[0]

                            results.append({
                                'title': title_elem.get_text(strip=True),
                                'url': url,
                                'snippet': snippet_elem.get_text(strip=True) if snippet_elem else ''
                            })

                    return results
        except Exception as e:
            logger.error(f"Google search failed: {e}")

        return []

    async def search_searx(self, query: str) -> List[Dict]:
        """
        Use public Searx instances (privacy-focused metasearch engine)
        Returns real URLs from multiple search engines
        """
        # Public Searx instances (these may change, you can find more at https://searx.space/)
        searx_instances = [
            "https://searx.be",
            "https://searx.info",
            "https://searx.tiekoetter.com"
        ]

        for instance in searx_instances:
            try:
                search_url = f"{instance}/search?q={quote(query)}&format=json"

                async with self.session.get(search_url, timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        results = []

                        for result in data.get('results', [])[:3]:
                            results.append({
                                'title': result.get('title', ''),
                                'url': result.get('url', ''),
                                'snippet': result.get('content', '')
                            })

                        if results:
                            return results
            except Exception as e:
                logger.debug(f"Searx instance {instance} failed: {e}")
                continue

        return []

    async def search_duckduckgo_html(self, query: str) -> List[Dict]:
        """
        Search DuckDuckGo HTML version and extract real URLs
        """
        try:
            search_url = f"https://duckduckgo.com/html/?q={quote(query)}"

            async with self.session.get(search_url, timeout=10) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')

                    results = []
                    for result in soup.find_all('div', class_=['result', 'results_links'])[:3]:
                        link_elem = result.find('a', class_='result__a')
                        snippet_elem = result.find('a', class_='result__snippet')

                        if link_elem:
                            url = link_elem.get('href', '')
                            # DuckDuckGo sometimes uses redirect URLs
                            if url.startswith('//duckduckgo.com/l/?'):
                                # Extract actual URL from redirect
                                try:
                                    url_parts = url.split('uddg=')[1] if 'uddg=' in url else url
                                    from urllib.parse import unquote
                                    url = unquote(url_parts.split('&')[0])
                                except:
                                    pass

                            results.append({
                                'title': link_elem.get_text(strip=True),
                                'url': url if url.startswith('http') else f"https:{url}" if url.startswith('//') else f"https://{url}",
                                'snippet': snippet_elem.get_text(strip=True) if snippet_elem else ''
                            })

                    return results
        except Exception as e:
            logger.error(f"DuckDuckGo HTML search failed: {e}")

        return []

    async def search_wikipedia(self, query: str) -> Dict:
        """
        Search Wikipedia for quick information
        """
        try:
            # Clean query for Wikipedia
            clean_query = self.clean_node_name(query)

            # First try search API to find best match
            search_api = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={quote(clean_query)}&limit=1&format=json"

            async with self.session.get(search_api, timeout=5) as response:
                if response.status == 200:
                    search_data = await response.json()
                    if len(search_data) > 1 and search_data[1]:
                        article_title = search_data[1][0]

                        # Get article summary
                        api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(article_title)}"

                        async with self.session.get(api_url, timeout=5) as response:
                            if response.status == 200:
                                data = await response.json()
                                return {
                                    'source': 'Wikipedia',
                                    'title': data.get('title', ''),
                                    'summary': data.get('extract', ''),
                                    'url': data.get('content_urls', {}).get('desktop', {}).get('page', ''),
                                    'image_url': data.get('thumbnail', {}).get('source', ''),
                                    'description': data.get('description', '')
                                }
        except Exception as e:
            logger.debug(f"Wikipedia search failed: {e}")

        return {}

    async def extract_locations(self, text: str) -> List[Dict]:
        """
        Extract location names from text using pattern matching
        """
        locations = []

        # Common location patterns
        # Countries
        countries = ['United States', 'USA', 'US', 'UK', 'United Kingdom', 'China', 'Russia',
                    'France', 'Germany', 'Japan', 'India', 'Brazil', 'Canada', 'Mexico',
                    'Australia', 'Italy', 'Spain', 'South Korea', 'Israel', 'Iran', 'Iraq',
                    'Syria', 'Ukraine', 'Poland', 'Turkey', 'Egypt', 'Saudi Arabia']

        # Major cities
        cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
                 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Boston',
                 'Seattle', 'Denver', 'Washington', 'DC', 'San Francisco', 'London',
                 'Paris', 'Tokyo', 'Beijing', 'Moscow', 'Berlin', 'Rome', 'Madrid',
                 'Sydney', 'Mumbai', 'Delhi', 'Shanghai', 'Hong Kong', 'Singapore']

        # States
        states = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania',
                 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'Washington', 'Arizona',
                 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin']

        text_lower = text.lower()

        # Check for countries
        for country in countries:
            if country.lower() in text_lower:
                locations.append({
                    'name': country,
                    'type': 'country',
                    'confidence': 0.9
                })

        # Check for cities
        for city in cities:
            if city.lower() in text_lower:
                locations.append({
                    'name': city,
                    'type': 'city',
                    'confidence': 0.8
                })

        # Check for states
        for state in states:
            if state.lower() in text_lower:
                locations.append({
                    'name': state,
                    'type': 'state',
                    'confidence': 0.7
                })

        # Remove duplicates
        seen = set()
        unique_locations = []
        for loc in locations:
            if loc['name'] not in seen:
                seen.add(loc['name'])
                unique_locations.append(loc)

        return unique_locations[:5]  # Return top 5 locations

    async def geocode_location(self, location_name: str) -> Dict:
        """
        Get coordinates for a location using Nominatim (OpenStreetMap)
        """
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={quote(location_name)}&format=json&limit=1"

            async with self.session.get(url, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        result = data[0]
                        return {
                            'name': location_name,
                            'display_name': result.get('display_name', ''),
                            'lat': float(result.get('lat', 0)),
                            'lon': float(result.get('lon', 0)),
                            'importance': result.get('importance', 0),
                            'type': result.get('type', ''),
                            'country': result.get('display_name', '').split(',')[-1].strip() if ',' in result.get('display_name', '') else ''
                        }
        except Exception as e:
            logger.debug(f"Geocoding failed for {location_name}: {e}")

        return None

    async def get_node_information(self, node_name: str, node_type: str = None) -> Dict:
        """
        Get comprehensive information about a node with REAL URLs and location data
        """
        try:
            # Clean and prepare search query
            search_query = self.clean_node_name(node_name)

            # Extract specific information for news nodes
            headline = ""
            category = ""
            if node_type == 'news' and '_' in node_name:
                parts = node_name.split('_')
                if len(parts) > 0:
                    category = parts[0].replace('&', ' and ')
                if len(parts) > 2:
                    headline = ' '.join(parts[2:]).replace('...', '').strip()
                    search_query = headline if headline else category

            results = {
                'node_name': node_name,
                'search_query': search_query,
                'category': category,
                'headline': headline,
                'summary': '',
                'image_url': '',
                'source_url': '',
                'web_results': [],
                'wikipedia': {},
                'locations': [],
                'geo_data': []
            }

            # Try multiple search sources in parallel
            tasks = []

            # Wikipedia search
            tasks.append(self.search_wikipedia(search_query))

            # Web searches - try multiple engines
            tasks.append(self.search_duckduckgo_html(search_query))
            tasks.append(self.search_bing(search_query))

            # Execute all searches in parallel
            search_results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process Wikipedia results
            wiki_data = search_results[0] if len(search_results) > 0 else {}
            if isinstance(wiki_data, dict) and wiki_data.get('summary'):
                results['wikipedia'] = wiki_data
                results['summary'] = wiki_data.get('summary', '')
                results['image_url'] = wiki_data.get('image_url', '')
                results['source_url'] = wiki_data.get('url', '')

            # Process web search results (DuckDuckGo)
            ddg_results = search_results[1] if len(search_results) > 1 else []
            if isinstance(ddg_results, list):
                for result in ddg_results:
                    if result.get('url') and result['url'].startswith('http'):
                        results['web_results'].append(result)

            # Process Bing results as fallback
            bing_results = search_results[2] if len(search_results) > 2 else []
            if isinstance(bing_results, list) and not results['web_results']:
                for result in bing_results:
                    if result.get('url') and result['url'].startswith('http'):
                        results['web_results'].append(result)

            # If no summary yet, try to get from first search result
            if not results['summary'] and results['web_results']:
                first_result = results['web_results'][0]
                results['summary'] = first_result.get('snippet', f"Search result for: {search_query}")
                if not results['source_url']:
                    results['source_url'] = first_result.get('url', '')

            # Generate a default summary if none found
            if not results['summary']:
                if headline:
                    results['summary'] = f"News article: {headline}"
                    if category:
                        results['summary'] += f" (Category: {category})"
                elif search_query:
                    results['summary'] = f"Search results for: {search_query}"
                else:
                    results['summary'] = "Click the links below to learn more."

            # Extract locations from the content
            combined_text = f"{headline} {results['summary']} "
            if results.get('wikipedia'):
                combined_text += results['wikipedia'].get('summary', '')

            locations = await self.extract_locations(combined_text)
            results['locations'] = locations

            # Geocode the locations
            if locations:
                geo_tasks = []
                for location in locations[:3]:  # Geocode top 3 locations
                    geo_tasks.append(self.geocode_location(location['name']))

                geo_results = await asyncio.gather(*geo_tasks, return_exceptions=True)

                for geo_data in geo_results:
                    if geo_data and not isinstance(geo_data, Exception):
                        results['geo_data'].append(geo_data)

            # Ensure we have at least one search link
            if not results['web_results']:
                # As a last resort, provide a Google search link
                google_search_url = f"https://www.google.com/search?q={quote(search_query)}"
                results['web_results'].append({
                    'title': f"Search Google for: {search_query}",
                    'snippet': f"Click to search for more information about {search_query}",
                    'url': google_search_url
                })

            # Limit results to top 3
            results['web_results'] = results['web_results'][:3]

            return results

        except Exception as e:
            logger.error(f"Failed to get node information: {e}")

            # Return with at least a Google search link
            search_query = self.clean_node_name(node_name)
            return {
                'node_name': node_name,
                'error': str(e),
                'summary': f'Search for: {search_query}',
                'web_results': [{
                    'title': f"Search Google for: {search_query}",
                    'snippet': "Click to search for more information",
                    'url': f"https://www.google.com/search?q={quote(search_query)}"
                }]
            }

    def clean_node_name(self, node_name: str) -> str:
        """
        Clean node name for better search results
        """
        # Remove special characters and formatting
        cleaned = re.sub(r'[_\-\.]', ' ', node_name)
        # Remove numbers at the beginning
        cleaned = re.sub(r'^\d+\s*', '', cleaned)
        # Remove common suffixes
        cleaned = re.sub(r'\s*(cluster|mixed|node)\s*\d*$', '', cleaned, flags=re.IGNORECASE)
        # Remove category prefixes for news
        if cleaned.upper().startswith(('POLITICS', 'ENTERTAINMENT', 'WELLNESS', 'SPORTS',
                                       'BUSINESS', 'TECH', 'SCIENCE', 'FOOD', 'TRAVEL')):
            # Remove the category and number
            cleaned = re.sub(r'^[A-Z]+(?:\s+&\s+[A-Z]+)?\s+\d+\s+', '', cleaned)
        # Clean up whitespace
        cleaned = ' '.join(cleaned.split())

        return cleaned