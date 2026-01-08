/**
 * Represents a string containing any combination of the specified result types, separated by commas.
 * Each result type corresponds to a specific category of search results that can be included in the search response.
 *
 * For more detailed information, refer to the [Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/query).
 *
 * @example
 * "discussions,videos" // Returns only query, discussions, and videos responses.
 * "news,web" // Returns only query, news, and web responses.
 */
export type ResultFilter = string;

/**
 * Options for configuring a web search requests to the Brave Search API.
 */
export interface BraveSearchOptions {
  /**
   * The search query country, where the results come from.
   * @type {string}
   * @default "us"
   */
  country?: string;
  /**
   * The search language preference.
   * @type {string}
   * @default "en"
   */
  search_lang?: string;
  /**
   * User interface language preferred in response.
   * @type {string}
   * @default "en-US"
   */
  ui_lang?: string;
  /**
   * Filters search results for adult content.
   * @type {SafeSearchLevel}
   * @default "moderate"
   */
  safesearch?: SafeSearchLevel;
  /**
   * Filters search results by when they were discovered.
   * Can be a predefined option from the FreshnessOption enum or a custom date range string.
   * @type {Freshness}
   * @example Using predefined timeranges
   * import { BraveSearch, FreshnessOption }
   * const braveSearch = new BraveSearch('your-api-key', {
   *   freshness: FreshnessOption.PastWeek
   * });
   * const resuls = await braveSearch.webSearch('some query', {
   *   freshness: FreshnessOption.PastWeek
   * });
   *
   * @example Using custom date range
   * import { BraveSearch, FreshnessOption }
   * const braveSearch = new BraveSearch('your-api-key', {
   *   freshness: FreshnessOption.PastWeek
   * });
   * const resuls = await braveSearch.webSearch('some query', {
   *   freshness: '2022-01-01to2022-12-31'
   * });
   */
  freshness?: Freshness;
  /**
   * Whether display strings should include decoration markers.
   * @type {boolean}
   * @default true
   */
  text_decorations?: boolean;
  /**
   * Whether to spellcheck the provided query.
   * @type {boolean}
   * @default true
   */
  spellcheck?: boolean;
  /**
   * Goggles act as a custom re-ranking on top of Brave’s search index.
   * @type {string}
   */
  goggles_id?: string;
  /**
   * The measurement units.
   * @type {UnitSystem}
   */
  units?: UnitSystem;
  /**
   * A snippet is an excerpt from a page you get as a result of the query, and extra_snippets allow you to get up to 5 additional, alternative excerpts.
   * @type {boolean}
   */
  extra_snippets?: boolean;
  /**
   * The number of search results returned in response.
   * @type {number}
   * @default 20
   */
  count?: number;
  /**
   * The zero-based offset that indicates the number of search results per page (count) to skip before returning the result.
   * @type {number}
   * @default 0
   */
  offset?: number;
  /**
   * A comma-delimited string of result types to include in the search response.
   * @type {ResultFilter}
   * @example
   * "discussions,videos" // Returns only query, discussions, and videos responses.
   * "news,web" // Returns only query, news, and web responses.
   */
  result_filter?: ResultFilter;
  /**
   * This parameter enables summary key generation in web search results.
   * @type boolean
   */
  summary?: boolean;
}

/**
 * Options for configuring polling behavior when waiting for summary results from the Brave Search API.
 */
export interface PollingOptions {
  /**
   * Interval in milliseconds between polling attempts for summary.
   * @type {number}
   * @default 500
   */
  pollInterval?: number;
  /**
   * Maximum number of attempts to poll for a summary.
   * @type {number}
   * @default 20
   */
  maxPollAttempts?: number;
}

/**
 * Options for configuring a AI summary answer content.
 */
export interface SummarizerOptions {
  /**
   * Returns extra entities info with the summary response.
   * @type {boolean}
   * @default "false"
   */
  entity_info?: boolean;
}

// Response types

/**
 * Response from the Brave Search API with different types of a web search content.
 */
export interface WebSearchApiResponse {
  /**
   * The type of web search API result. The value is always "search".
   * @type {string}
   */
  type: "search";
  /**
   * Discussions clusters aggregated from forum posts that are relevant to the query.
   * @type {Discussions}
   */
  discussions?: Discussions;
  /**
   * Frequently asked questions that are relevant to the search query.
   * @type {FAQ}
   */
  faq?: FAQ;
  /**
   * Aggregated information on an entity showable as an infobox.
   * @type {GraphInfobox}
   */
  infobox?: GraphInfobox;
  /**
   * Places of interest (POIs) relevant to location sensitive queries.
   * @type {Locations}
   */
  locations?: Locations;
  /**
   * Preferred ranked order of search results.
   * @type {MixedResponse}
   */
  mixed?: MixedResponse;
  /**
   * News results relevant to the query.
   * @type {News}
   */
  news?: News;
  /**
   * Search query string and its modifications that are used for search.
   * @type {Query}
   */
  query: Query;
  /**
   * Videos relevant to the query.
   * @type {Videos}
   */
  videos?: Videos;
  /**
   * Web search results relevant to the query.
   * @type {Search}
   */
  web?: Search;
  /**
   * Summary key to get AI generated summary results for the query. (Handled automatically when using getSummarizedAnswer method, that polls for summary right after web search response returned)
   * @type {Summarizer}
   */
  summarizer?: Summarizer;
}

/**
 * Response from the Brave Search API with AI generated summary of search results.
 */
export interface SummarizerSearchApiResponse {
  /**
   * The type of summarizer search API result. The value is always "summarizer".
   * @type {string}
   */
  type: "summarizer";
  /**
   * The current status of summarizer for the given key. The value can be either "failed" or "complete".
   * @type {string}
   */
  status: "failed" | "complete";
  /**
   * The title for the summary.
   * @type {string}
   */
  title?: string;
  /**
   * Details for the summary message.
   * @type {SummaryMessage[]}
   */
  summary?: SummaryMessage[];
  /**
   * Enrichments that can be added to the summary message.
   * @type {SummaryEnrichments}
   */
  enrichments?: SummaryEnrichments;
  /**
   * Followup queries relevant to the current query.
   * @type {string[]}
   */
  followups?: string[];
  /**
   * Details on the entities in the summary message.
   * @type {Record<string, SummaryEntityInfo>}
   */
  entities_infos?: { [key: string]: SummaryEntityInfo };
}

/**
 * Response from the Brave Search API for a local points of interest (POI) search request.
 */
export interface LocalPoiSearchApiResponse {
  /**
   * The type of local POI search API result. The value is always "local_pois".
   * @type {string}
   */
  type: "local_pois";
  /**
   * Location results matching the ids in the request.
   * @type {LocationResult[]}
   */
  results: LocationResult[];
}

/**
 * Response from the Brave Search API with Location descriptions.
 */
export interface LocalDescriptionsSearchApiResponse {
  /**
   * The type of local description search API result. The value is always "local_descriptions".
   * @type {string}
   */
  type: "local_descriptions";
  /**
   * Location descriptions matching the ids in the request.
   * @type {LocationDescription[]}
   */
  results: LocationDescription[];
}

// Common types

export interface MetaUrl {
  /**
   * The protocol scheme extracted from the url.
   * @type {string}
   */
  scheme: string;
  /**
   * The network location part extracted from the url.
   * @type {string}
   */
  netloc: string;
  /**
   * The lowercased domain name extracted from the url.
   * @type {string}
   */
  hostname: string;
  /**
   * The favicon used for the url.
   * @type {string}
   */
  favicon: string;
  /**
   * The hierarchical path of the url useful as a display string.
   * @type {string}
   */
  path: string;
}

export interface Thumbnail {
  /**
   * The served url of the picture thumbnail.
   * @type {string}
   */
  src: string;
  /**
   * An alternate text for the image, if the image cannot be displayed.
   * @type {string}
   */
  alt?: string;
  /**
   * The height of the image.
   * @type {number}
   */
  height?: number;
  /**
   * The width of the image.
   * @type {number}
   */
  width?: number;
  /**
   * The background color of the image.
   * @type {string}
   */
  bg_color?: string;
  /**
   * The original url of the image.
   * @type {string}
   */
  original?: string;
  /**
   * Whether the image is a logo.
   * @type {boolean}
   */
  logo?: boolean;
  /**
   * Whether the image is duplicated.
   * @type {boolean}
   */
  duplicated?: boolean;
  /**
   * The theme associated with the image.
   * @type {string}
   */
  theme?: string;
}

export interface Rating {
  /**
   * The current value of the rating.
   * @type {number}
   */
  ratingValue: number;
  /**
   * Best rating received.
   * @type {number}
   */
  bestRating: number;
  /**
   * The number of reviews associated with the rating.
   * @type {number}
   */
  reviewCount: number;
  /**
   * The profile associated with the rating.
   * @type {Profile}
   */
  profile?: Profile;
  /**
   * Whether the rating is coming from Tripadvisor.
   * @type {boolean}
   */
  is_tripadvisor?: boolean;
}

export interface Profile {
  /**
   * The name of the profile.
   * @type {string}
   */
  name: string;
  /**
   * The long name of the profile.
   * @type {string}
   */
  long_name?: string;
  /**
   * The original url where the profile is available.
   * @type {string}
   */
  url: string;
  /**
   * The served image url representing the profile.
   * @type {string}
   */
  img: string;
}

export interface Unit {
  /**
   * The quantity of the unit.
   * @type {number}
   */
  value: number;
  /**
   * The name of the unit associated with the quantity.
   * @type {string}
   */
  units: string;
}

// Specific types for each part of the response

export interface Discussions {
  /**
   * The type identifying a discussion cluster. Currently the value is always "search".
   * @type {string}
   */
  type: "search";
  /**
   * A list of discussion results.
   * @type {DiscussionResult[]}
   */
  results: DiscussionResult[];
  /**
   * Whether the discussion results are changed by a Goggle. False by default.
   * @type {boolean}
   */
  mutated_by_goggles: boolean;
}

export interface DiscussionResult extends Omit<SearchResult, "type"> {
  /**
   * The discussion result type identifier. The value is always "discussion".
   * @type {string}
   */
  type: "discussion";
  /**
   * The enriched aggregated data for the relevant forum post.
   * @type {ForumData}
   */
  data: ForumData;
}

export interface ForumData {
  /**
   * The name of the forum.
   * @type {string}
   */
  forum_name: string;
  /**
   * The number of answers to the post.
   * @type {number}
   */
  num_answers: number;
  /**
   * The score of the post on the forum.
   * @type {string}
   */
  score: string;
  /**
   * The title of the post on the forum.
   * @type {string}
   */
  title: string;
  /**
   * The question asked in the forum post.
   * @type {string}
   */
  question: string;
  /**
   * The top-rated comment under the forum post.
   * @type {string}
   */
  top_comment: string;
}

export interface FAQ {
  /**
   * The FAQ result type identifier. The value is always "faq".
   * @type {string}
   */
  type: "faq";
  /**
   * A list of aggregated question answer results relevant to the query.
   * @type {QA[]}
   */
  results: QA[];
}

export interface QA {
  /**
   * The question being asked.
   * @type {string}
   */
  question: string;
  /**
   * The answer to the question.
   * @type {string}
   */
  answer: string;
  /**
   * The title of the post.
   * @type {string}
   */
  title: string;
  /**
   * The url pointing to the post.
   * @type {string}
   */
  url: string;
  /**
   * Aggregated information about the url.
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
}

export interface GraphInfobox {
  /**
   * The type identifier for infoboxes. The value is always "graph".
   * @type {string}
   */
  type: "graph";
  /**
   * A list of infoboxes associated with the query.
   * @type {GenericInfobox | QAInfobox | InfoboxPlace | InfoboxWithLocation}
   */
  results: GenericInfobox | QAInfobox | InfoboxPlace | InfoboxWithLocation;
}

export interface AbstractGraphInfobox extends Result {
  /**
   * The infobox result type identifier. The value is always "infobox".
   * @type {string}
   */
  type: "infobox";
  /**
   * The position on a search result page.
   * @type {number}
   */
  position: number;
  /**
   * Any label associated with the entity.
   * @type {string}
   */
  label?: string;
  /**
   * Category classification for the entity.
   * @type {string}
   */
  category?: string;
  /**
   * A longer description for the entity.
   * @type {string}
   */
  long_desc?: string;
  /**
   * The thumbnail associated with the entity.
   * @type {Thumbnail}
   */
  thumbnail?: Thumbnail;
  /**
   * A list of attributes about the entity.
   * @type {string[][]}
   */
  attributes?: string[][];
  /**
   * The profiles associated with the entity.
   * @type {Profile[] | DataProvider[]}
   */
  profiles?: Profile[] | DataProvider[];
  /**
   * The official website pertaining to the entity.
   * @type {string}
   */
  website_url?: string;
  /**
   * Any ratings given to the entity.
   * @type {Rating[]}
   */
  ratings?: Rating[];
  /**
   * A list of data sources for the entity.
   * @type {DataProvider[]}
   */
  providers?: DataProvider[];
  /**
   * A unit representing quantity relevant to the entity.
   * @type {Unit}
   */
  distance?: Unit;
  /**
   * A list of images relevant to the entity.
   * @type {Thumbnail[]}
   */
  images?: Thumbnail[];
  /**
   * Any movie data relevant to the entity. Appears only when the result is a movie.
   * @type {MovieData}
   */
  movie?: MovieData;
}

export interface GenericInfobox extends AbstractGraphInfobox {
  /**
   * The infobox subtype identifier. The value is always "generic".
   * @type {string}
   */
  subtype: "generic";
  /**
   * List of urls where the entity was found.
   * @type {string[]}
   */
  found_in_urls: string[];
}

export interface QAInfobox extends AbstractGraphInfobox {
  /**
   * The infobox subtype identifier. The value is always "code".
   * @type {string}
   */
  subtype: "code";
  /**
   * The question and relevant answer.
   * @type {QAPage}
   */
  data: QAPage;
  /**
   * Detailed information on the page containing the question and relevant answer.
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
}

export interface InfoboxWithLocation extends AbstractGraphInfobox {
  /**
   * The infobox subtype identifier. The value is always "location".
   * @type {string}
   */
  subtype: "location";
  /**
   * Whether the entity a location.
   * @type {boolean}
   */
  is_location: boolean;
  /**
   * The coordinates of the location.
   * @type {number[]}
   */
  coordinates: [number, number];
  /**
   * The map zoom level.
   * @type {number}
   */
  zoom_level: number;
  /**
   * The location result.
   * @type {LocationResult}
   */
  location: LocationResult;
}

export interface InfoboxPlace extends AbstractGraphInfobox {
  /**
   * The infobox subtype identifier. The value is always "place".
   * @type {string}
   */
  subtype: "place";
  /**
   * The location result.
   * @type {LocationResult}
   */
  location: LocationResult;
}

export interface Locations {
  /**
   * The type identifying a location cluster. Currently the value is always "locations".
   * @type {string}
   */
  type: "locations";
  /**
   * An aggregated list of location sensitive results.
   * @type {LocationResult[]}
   */
  results: LocationResult[];
}

export interface MixedResponse {
  /**
   * The type representing the model mixed. The value is always "mixed".
   * @type {string}
   */
  type: "mixed";
  /**
   * The ranking order for the main section of the search result page.
   * @type {ResultReference[]}
   */
  main: ResultReference[];
  /**
   * The ranking order for the top section of the search result page.
   * @type {ResultReference[]}
   */
  top: ResultReference[];
  /**
   * The ranking order for the side section of the search result page.
   * @type {ResultReference[]}
   */
  side: ResultReference[];
}

export interface ResultReference {
  /**
   * The type of the result.
   * @type {string}
   */
  type: string;
  /**
   * The 0th based index where the result should be placed.
   * @type {number}
   */
  index: number;
  /**
   * Whether to put all the results from the type at specific position.
   * @type {boolean}
   */
  all: boolean;
}

export interface News {
  /**
   * The type representing the news. The value is always "news".
   * @type {string}
   */
  type: "news";
  /**
   * A list of news results.
   * @type {NewsResult[]}
   */
  results: NewsResult[];
  /**
   * Whether the news results are changed by a Goggle. False by default.
   * @type {boolean}
   */
  mutated_by_goggles: boolean;
}

export interface Query {
  /**
   * The original query that was requested.
   * @type {string}
   */
  original: string;
  /**
   * Whether there is more content available for query, but the response was restricted due to safesearch.
   * @type {boolean}
   */
  show_strict_warning: boolean;
  /**
   * The altered query for which the search was performed.
   * @type {string}
   */
  altered: string;
  /**
   * Whether safesearch was enabled.
   * @type {boolean}
   */
  safesearch: boolean;
  /**
   * Whether the query is a navigational query to a domain.
   * @type {boolean}
   */
  is_navigational: boolean;
  /**
   * Whether the query has location relevance.
   * @type {boolean}
   */
  is_geolocal: boolean;
  /**
   * Whether the query was decided to be location sensitive.
   * @type {string}
   */
  local_decision: string;
  /**
   * The index of the location.
   * @type {number}
   */
  local_locations_idx: number;
  /**
   * Whether the query is trending.
   * @type {boolean}
   */
  is_trending: boolean;
  /**
   * Whether the query has news breaking articles relevant to it.
   * @type {boolean}
   */
  is_news_breaking: boolean;
  /**
   * Whether the query requires location information for better results.
   * @type {boolean}
   */
  ask_for_location: boolean;
  /**
   * The language information gathered from the query.
   * @type {Language}
   */
  language: Language;
  /**
   * Whether the spellchecker was off.
   * @type {boolean}
   */
  spellcheck_off: boolean;
  /**
   * The country that was used.
   * @type {string}
   */
  country: string;
  /**
   * Whether there are bad results for the query.
   * @type {boolean}
   */
  bad_results: boolean;
  /**
   * Whether the query should use a fallback.
   * @type {boolean}
   */
  should_fallback: boolean;
  /**
   * The gathered location latitutde associated with the query.
   * @type {string}
   */
  lat?: string;
  /**
   * The gathered location longitude associated with the query.
   * @type {string}
   */
  long?: string;
  /**
   * The gathered postal code associated with the query.
   * @type {string}
   */
  postal_code?: string;
  /**
   * The gathered city associated with the query.
   * @type {string}
   */
  city?: string;
  /**
   * The gathered state associated with the query.
   * @type {string}
   */
  state?: string;
  /**
   * The country for the request origination.
   * @type {string}
   */
  header_country: string;
  /**
   * Whether more results are available for the given query.
   * @type {boolean}
   */
  more_results_available: boolean;
  /**
   * Any custom location labels attached to the query.
   * @type {string}
   */
  custom_location_label?: string;
  /**
   * Any reddit cluster associated with the query.
   * @type {string}
   */
  reddit_cluster?: string;
  /**
   * A summary key to get summary details.
   * @type {string}
   */
  summary_key?: string;
}

export interface Videos {
  /**
   * The type representing the videos. The value is always "videos".
   * @type {string}
   */
  type: "videos";
  /**
   * A list of video results.
   * @type {VideoResult[]}
   */
  results: VideoResult[];
  /**
   * Whether the video results are changed by a Goggle. False by default.
   * @type {boolean}
   */
  mutated_by_goggles: boolean;
}

export interface Search {
  /**
   * A type identifying web search results. The value is always "search".
   * @type {string}
   */
  type: "search";
  /**
   * A list of search results.
   * @type {SearchResult[]}
   */
  results: SearchResult[];
  /**
   * Whether the results are family friendly.
   * @type {boolean}
   */
  family_friendly: boolean;
}

export interface Summarizer {
  /**
   * The value is always "summarizer".
   * @type {string}
   */
  type: "summarizer";
  /**
   * The key for the summarizer API.
   * @type {string}
   */
  key: string;
}

// Result types

export interface Result {
  /**
   * The title of the web page.
   * @type {string}
   */
  title: string;
  /**
   * The url where the page is served.
   * @type {string}
   */
  url: string;
  /**
   * Whether the entity a location.
   * @type {boolean}
   */
  is_source_local?: boolean;
  /**
   * Whether the entity a location.
   * @type {boolean}
   */
  is_source_both?: boolean;
  /**
   * A description for the web page.
   * @type {string}
   */
  description: string;
  /**
   * A date representing the age of the web page.
   * @type {string}
   */
  page_age?: string;
  /**
   * A date representing when the web page was last fetched.
   * @type {string}
   */
  page_fetched?: string;
  /**
   * A profile associated with the web page.
   * @type {Profile}
   */
  profile?: Profile;
  /**
   * A language classification for the web page.
   * @type {string}
   */
  language?: string;
  /**
   * Whether the web page is family friendly.
   * @type {boolean}
   */
  family_friendly: boolean;
}

export interface SearchResult extends Result {
  /**
   * A type identifying a web search result. The value is always "search_result".
   * @type {string}
   */
  type: "search_result";
  /**
   * A sub type identifying the web search result type.
   * @type {string}
   */
  subtype: "generic";
  /**
   * Gathered information on a web search result.
   * @type {DeepResult}
   */
  deep_results?: DeepResult;
  /**
   * A list of schemas extracted from the web search result.
   * @type {any[][]}
   */
  schemas?: any[][];
  /**
   * Aggregated information on the url associated with the web search result.
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
  /**
   * The thumbnail of the web search result.
   * @type {Thumbnail}
   */
  thumbnail?: Thumbnail;
  /**
   * A string representing the age of the web search result.
   * @type {string}
   */
  age?: string;
  /**
   * The main language on the web search result.
   * @type {string}
   */
  language?: string;
  /**
   * The location details if the query relates to a restaurant.
   * @type {LocationResult}
   */
  location?: LocationResult;
  /**
   * The video associated with the web search result.
   * @type {VideoData}
   */
  video?: VideoData;
  /**
   * The movie associated with the web search result.
   * @type {MovieData}
   */
  movie?: MovieData;
  /**
   * Any frequently asked questions associated with the web search result.
   * @type {FAQ}
   */
  faq?: FAQ;
  /**
   * Any question answer information associated with the web search result page.
   * @type {QAPage}
   */
  qa?: QAPage;
  /**
   * Any book information associated with the web search result page.
   * @type {Book}
   */
  book?: Book;
  /**
   * Rating found for the web search result page.
   * @type {Rating}
   */
  rating?: Rating;
  /**
   * An article found for the web search result page.
   * @type {Article}
   */
  article?: Article;
  /**
   * The main product and a review that is found on the web search result page.
   * @type {ProductReview}
   */
  product?: ProductReview;
  /**
   * A list of products and reviews that are found on the web search result page.
   * @type {ProductReview[]}
   */
  product_cluster?: ProductReview[];
  /**
   * A type representing a cluster. The value can be "product_cluster".
   * @type {string}
   */
  cluster_type?: string;
  /**
   * A list of web search results.
   * @type {Result[]}
   */
  cluster?: Result[];
  /**
   * Aggregated information on the creative work found on the web search result.
   * @type {CreativeWork}
   */
  creative_work?: CreativeWork;
  /**
   * Aggregated information on music recording found on the web search result.
   * @type {MusicRecording}
   */
  music_recording?: MusicRecording;
  /**
   * Aggregated information on the review found on the web search result.
   * @type {Review}
   */
  review?: Review;
  /**
   * Aggregated information on a software product found on the web search result page.
   * @type {Software}
   */
  software?: Software;
  /**
   * Aggregated information on a recipe found on the web search result page.
   * @type {Recipe}
   */
  recipe?: Recipe;
  /**
   * Aggregated information on a organization found on the web search result page.
   * @type {Organization}
   */
  organization?: Organization;
  /**
   * The content type associated with the search result page.
   * @type {string}
   */
  content_type?: string;
  /**
   * A list of extra alternate snippets for the web search result.
   * @type {string[]}
   */
  extra_snippets?: string[];
}

export interface NewsResult extends Result {
  /**
   * Aggregated information on the url representing a news result
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
  /**
   * The source of the news.
   * @type {string}
   */
  source: string;
  /**
   * Whether the news result is currently a breaking news.
   * @type {boolean}
   */
  breaking: boolean;
  /**
   * The thumbnail associated with the news result.
   * @type {Thumbnail}
   */
  thumbnail?: Thumbnail;
  /**
   * A string representing the age of the news article.
   * @type {string}
   */
  age: string;
  /**
   * A list of extra alternate snippets for the news search result.
   * @type {string[]}
   */
  extra_snippets?: string[];
}

export interface VideoResult extends Result {
  /**
   * The type identifying the video result. The value is always "video_result".
   * @type {string}
   */
  type: "video_result";
  /**
   * Meta data for the video.
   * @type {VideoData}
   */
  video: VideoData;
  /**
   * Aggregated information on the URL
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
  /**
   * The thumbnail of the video.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * A string representing the age of the video.
   * @type {string}
   */
  age: string;
}

export interface LocationResult extends Result {
  /**
   * The type identifying the location result. The value is always "location_result".
   * @type {string}
   */
  type: "location_result";
  /**
   * A Temporary id associated with this result, which can be used to retrieve extra information about the location. It remains valid for 8 hours.
   * @type {string}
   */
  id: string;
  /**
   * The complete url of the provider.
   * @type {string}
   */
  provider_url: string;
  /**
   * A list of coordinates associated with the location. This is a lat long represented as a floating point.
   * @type {number[]}
   */
  coordinates: [number, number];
  /**
   * The zoom level on the map.
   * @type {number}
   */
  zoom_level: number;
  /**
   * The thumbnail associated with the location.
   * @type {Thumbnail}
   */
  thumbnail?: Thumbnail;
  /**
   * The postal address associated with the location.
   * @type {PostalAddress}
   */
  postal_address: PostalAddress;
  /**
   * The opening hours, if it is a business, associated with the location.
   * @type {OpeningHours}
   */
  opening_hours?: OpeningHours;
  /**
   * The contact of the business associated with the location.
   * @type {Contact}
   */
  contact?: Contact;
  /**
   * A display string used to show the price classification for the business.
   * @type {string}
   */
  price_range?: string;
  /**
   * The ratings of the business.
   * @type {Rating}
   */
  rating?: Rating;
  /**
   * The distance of the location from the client.
   * @type {Unit}
   */
  distance?: Unit;
  /**
   * Profiles associated with the business.
   * @type {DataProvider[]}
   */
  profiles?: DataProvider[];
  /**
   * Aggregated reviews from various sources relevant to the business.
   * @type {Reviews}
   */
  reviews?: Reviews;
  /**
   * A bunch of pictures associated with the business.
   * @type {PictureResults}
   */
  pictures?: PictureResults;
  /**
   * An action to be taken.
   * @type {Action}
   */
  action?: Action;
  /**
   * A list of cuisine categories served.
   * @type {string[]}
   */
  serves_cuisine?: string[];
  /**
   * A list of categories.
   * @type {string[]}
   */
  categories?: string[];
  /**
   * An icon category.
   * @type {string}
   */
  icon_category?: string;
  /**
   * Web results related to this location.
   * @type {LocationWebResult}
   */
  results?: LocationWebResult;
  /**
   * IANA timezone identifier.
   * @type {string}
   */
  timezone?: string;
  /**
   * The utc offset of the timezone.
   * @type {string}
   */
  timezone_offset?: string;
}

export interface LocationDescription {
  /**
   * The type of a location description. The value is always "local_description".
   * @type {string}
   */
  type: "local_description";
  /**
   * A Temporary id of the location with this description.
   * @type {string}
   */
  id: string;
  /**
   * AI generated description of the location with the given id.
   * @type {string}
   */
  description: string;
}

// Additional types

export interface Language {
  /**
   * The main language seen in the string.
   * @type {string}
   */
  main: string;
}

export interface DeepResult {
  /**
   * A list of news results associated with the result.
   * @type {NewsResult[]}
   */
  news?: NewsResult[];
  /**
   * A list of buttoned results associated with the result.
   * @type {ButtonResult[]}
   */
  buttons?: ButtonResult[];
  /**
   * Social profile associated with the result.
   * @type {KnowledgeGraphProfile[]}
   */
  social?: KnowledgeGraphProfile[];
  /**
   * Videos associated with the result.
   * @type {VideoResult[]}
   */
  videos?: VideoResult[];
  /**
   * Images associated with the result.
   * @type {Image[]}
   */
  images?: Image[];
}

export interface ButtonResult {
  /**
   * A type identifying button result. The value is always "button_result".
   * @type {string}
   */
  type: "button_result";
  /**
   * The title of the result.
   * @type {string}
   */
  title: string;
  /**
   * The url for the button result.
   * @type {string}
   */
  url: string;
}

export interface KnowledgeGraphProfile {
  /**
   * A short title describing the entity.
   * @type {string}
   */
  title: string;
  /**
   * A description of the entity.
   * @type {string}
   */
  description: string;
  /**
   * The url representing the entity.
   * @type {string}
   */
  url: string;
  /**
   * The thumbnail associated with the entity.
   * @type {string}
   */
  thumbnail: string;
}

export interface Image {
  /**
   * The thumbnail associated with the image.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The url of the image.
   * @type {string}
   */
  url: string;
  /**
   * Metadata on the image.
   * @type {ImageProperties}
   */
  properties: ImageProperties;
}

export interface ImageProperties {
  /**
   * The image URL.
   * @type {string}
   */
  url: string;
  /**
   * The resized image.
   * @type {string}
   */
  resized: string;
  /**
   * The height of the image.
   * @type {number}
   */
  height: number;
  /**
   * The width of the image.
   * @type {number}
   */
  width: number;
  /**
   * The format specifier for the image.
   * @type {string}
   */
  format: string;
  /**
   * The image storage size.
   * @type {string}
   */
  content_size: string;
}

export interface VideoData {
  /**
   * A time string representing the duration of the video. The format can be HH:MM:SS or MM:SS.
   * @type {string}
   */
  duration: string;
  /**
   * The number of views of the video.
   * @type {string}
   */
  views: string;
  /**
   * The creator of the video.
   * @type {string}
   */
  creator: string;
  /**
   * The publisher of the video.
   * @type {string}
   */
  publisher: string;
  /**
   * A thumbnail associated with the video.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
}

export interface MovieData {
  /**
   * Name of the movie.
   * @type {string}
   */
  name: string;
  /**
   * A short plot summary for the movie.
   * @type {string}
   */
  description: string;
  /**
   * A url serving a movie profile page.
   * @type {string}
   */
  url: string;
  /**
   * A thumbnail for a movie poster.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The release date for the movie.
   * @type {string}
   */
  release: string;
  /**
   * A list of people responsible for directing the movie.
   * @type {Person[]}
   */
  directors: Person[];
  /**
   * A list of actors in the movie.
   * @type {Person[]}
   */
  actors: Person[];
  /**
   * Rating provided to the movie from various sources.
   * @type {Rating}
   */
  rating: Rating;
  /**
   * The runtime of the movie. The format is HH:MM:SS.
   * @type {string}
   */
  duration: string;
  /**
   * List of genres in which the movie can be classified.
   * @type {string[]}
   */
  genre: string[];
  /**
   * The query that resulted in the movie result.
   * @type {string}
   */
  query: string;
}

export interface QAPage {
  /**
   * The question that is being asked.
   * @type {string}
   */
  question: string;
  /**
   * An answer to the question.
   * @type {Answer}
   */
  answer: Answer;
}

export interface Answer {
  /**
   * The main content of the answer.
   * @type {string}
   */
  text: string;
  /**
   * The name of the author of the answer.
   * @type {string}
   */
  author: string;
  /**
   * Number of upvotes on the answer.
   * @type {number}
   */
  upvoteCount: number;
  /**
   * The number of downvotes on the answer.
   * @type {number}
   */
  downvoteCount: number;
}

export interface Book {
  /**
   * The title of the book.
   * @type {string}
   */
  title: string;
  /**
   * The author of the book.
   * @type {Person[]}
   */
  author: Person[];
  /**
   * The publishing date of the book.
   * @type {string}
   */
  date: string;
  /**
   * The price of the book.
   * @type {Price}
   */
  price: Price;
  /**
   * The number of pages in the book.
   * @type {number}
   */
  pages: number;
  /**
   * The publisher of the book.
   * @type {Person}
   */
  publisher: Person;
  /**
   * A gathered rating from different sources associated with the book.
   * @type {Rating}
   */
  rating: Rating;
}

export interface Price {
  /**
   * The price value in a given currency.
   * @type {string}
   */
  price: string;
  /**
   * The current of the price value.
   * @type {string}
   */
  price_currency: string;
}

export interface Article {
  /**
   * The author of the article.
   * @type {Person[]}
   */
  author: Person[];
  /**
   * The date when the article was published.
   * @type {string}
   */
  date: string;
  /**
   * The name of the publisher for the article.
   * @type {Organization}
   */
  publisher: Organization;
  /**
   * A thumbnail associated with the article.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * Whether the article is free to read or is behind a paywall.
   * @type {boolean}
   */
  isAccessibleForFree: boolean;
}

export interface ProductReview {
  /**
   * The name of the product.
   * @type {string}
   */
  name: string;
  /**
   * The price of the product.
   * @type {string}
   */
  price: string;
  /**
   * A thumbnail associated with the product.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The description of the product.
   * @type {string}
   */
  description: string;
  /**
   * Offers available on the product.
   * @type {Offer[]}
   */
  offers: Offer[];
  /**
   * A rating given to the product from various sources.
   * @type {Rating}
   */
  rating: Rating;
}

export interface Offer {
  /**
   * The url where the offer can be found.
   * @type {string}
   */
  url: string;
  /**
   * The currency in which the offer is made.
   * @type {string}
   */
  priceCurrency: string;
  /**
   * The price of the product currently on offer.
   * @type {string}
   */
  price: string;
}

export interface CreativeWork {
  /**
   * The name of the creative work.
   * @type {string}
   */
  name: string;
  /**
   * A thumbnail associated with the creative work.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * A rating that is given to the creative work.
   * @type {Rating}
   */
  rating: Rating;
}

export interface MusicRecording {
  /**
   * The name of the song or album.
   * @type {string}
   */
  name: string;
  /**
   * A thumbnail associated with the music.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The rating of the music.
   * @type {Rating}
   */
  rating: Rating;
}

export interface Review {
  /**
   * A string representing review type. This is always "review".
   * @type {string}
   */
  type: "review";
  /**
   * The review title for the review.
   * @type {string}
   */
  name: string;
  /**
   * The thumbnail associated with the reviewer.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * A description of the review (the text of the review itself).
   * @type {string}
   */
  description: string;
  /**
   * The ratings associated with the review.
   * @type {Rating}
   */
  rating: Rating;
}

export interface Software {
  /**
   * The name of the software product.
   * @type {string}
   */
  name: string;
  /**
   * The author of software product.
   * @type {string}
   */
  author: string;
  /**
   * The latest version of the software product.
   * @type {string}
   */
  version: string;
  /**
   * The code repository where the software product is currently available or maintained.
   * @type {string}
   */
  codeRepository: string;
  /**
   * The home page of the software product.
   * @type {string}
   */
  homepage: string;
  /**
   * The date when the software product was published.
   * @type {string}
   */
  datePublisher: string;
  /**
   * Whether the software product is available on npm.
   * @type {boolean}
   */
  is_npm: boolean;
  /**
   * Whether the software product is available on pypi.
   * @type {boolean}
   */
  is_pypi: boolean;
  /**
   * The number of stars on the repository.
   * @type {number}
   */
  stars: number;
  /**
   * The numbers of forks of the repository.
   * @type {number}
   */
  forks: number;
  /**
   * The programming language spread on the software product.
   * @type {string}
   */
  ProgrammingLanguage: string;
}

export interface Recipe {
  /**
   * The title of the recipe.
   * @type {string}
   */
  title: string;
  /**
   * The description of the recipe.
   * @type {string}
   */
  description: string;
  /**
   * A thumbnail associated with the recipe.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The url of the web page where the recipe was found.
   * @type {string}
   */
  url: string;
  /**
   * The domain of the web page where the recipe was found.
   * @type {string}
   */
  domain: string;
  /**
   * The url for the favicon of the web page where the recipe was found.
   * @type {string}
   */
  favicon: string;
  /**
   * The total time required to cook the recipe.
   * @type {string}
   */
  time: string;
  /**
   * The preparation time for the recipe.
   * @type {string}
   */
  prep_time: string;
  /**
   * The cooking time for the recipe.
   * @type {string}
   */
  cook_time: string;
  /**
   * Ingredients required for the recipe.
   * @type {string}
   */
  ingredients: string;
  /**
   * List of instructions for the recipe.
   * @type {HowTo[]}
   */
  instructions: HowTo[];
  /**
   * How many people the recipe serves.
   * @type {number}
   */
  servings: number;
  /**
   * Calorie count for the recipe.
   * @type {number}
   */
  calories: number;
  /**
   * Aggregated information on the ratings associated with the recipe.
   * @type {Rating}
   */
  rating: Rating;
  /**
   * The category of the recipe.
   * @type {string}
   */
  recipeCategory: string;
  /**
   * The cuisine classification for the recipe.
   * @type {string}
   */
  recipeCuisine: string;
  /**
   * Aggregated information on the cooking video associated with the recipe.
   * @type {VideoData}
   */
  video: VideoData;
}

export interface HowTo {
  /**
   * The how to text.
   * @type {string}
   */
  text: string;
  /**
   * A name for the how to.
   * @type {string}
   */
  name: string;
  /**
   * A url associated with the how to.
   * @type {string}
   */
  url: string;
  /**
   * A list of image urls associated with the how to.
   * @type {string[]}
   */
  image: string[];
}

export interface Organization {
  /**
   * A string representing a type identifying an organization. The value is always "organization".
   * @type {string}
   */
  type: "organization";
  /**
   * The name of the organization.
   * @type {string}
   */
  name: string;
  /**
   * The url representing the organization.
   * @type {string}
   */
  url: string;
  /**
   * The thumbnail associated with the organization.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * A list of contact points for the organization.
   * @type {ContactPoint[]}
   */
  contact_points: ContactPoint[];
}

export interface ContactPoint {
  /**
   * A string representing a type identifying a contact point. The value is always "contact_point".
   * @type {string}
   */
  type: "contact_point";
  /**
   * The telephone number of the entity.
   * @type {string}
   */
  telephone: string;
  /**
   * The email address of the entity.
   * @type {string}
   */
  email: string;
}

export interface Person {
  /**
   * A string representing a type identifying a person. The value is always "person".
   * @type {string}
   */
  type: "person";
  /**
   * The name of the person.
   * @type {string}
   */
  name: string;
  /**
   * The url where further details on the person can be found.
   * @type {string}
   */
  url: string;
  /**
   * The thumbnail associated with the person.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
}

export interface PostalAddress {
  /**
   * A string representing a type identifying a postal address. The value is always "PostalAddress".
   * @type {string}
   */
  type: "PostalAddress";
  /**
   * The country associated with the location.
   * @type {string}
   */
  country: string;
  /**
   * The postal code associated with the location.
   * @type {string}
   */
  postalCode: string;
  /**
   * The street address associated with the location.
   * @type {string}
   */
  streetAddress: string;
  /**
   * The region associated with the location. This is usually a state.
   * @type {string}
   */
  addressRegion: string;
  /**
   * The address locality or subregion associated with the location.
   * @type {string}
   */
  addressLocality: string;
  /**
   * The displayed address string.
   * @type {string}
   */
  displayAddress: string;
}

export interface OpeningHours {
  /**
   * The current day opening hours. Can have two sets of opening hours.
   * @type {DayOpeningHours[]}
   */
  current_day: DayOpeningHours[];
  /**
   * The opening hours for the whole week.
   * @type {DayOpeningHours[][]}
   */
  days: DayOpeningHours[][];
}

export interface DayOpeningHours {
  /**
   * A short string representing the day of the week.
   * @type {string}
   */
  abbr_name: string;
  /**
   * A full string representing the day of the week.
   * @type {string}
   */
  full_name: string;
  /**
   * A 24 hr clock time string for the opening time of the business on a particular day.
   * @type {string}
   */
  opens: string;
  /**
   * A 24 hr clock time string for the closing time of the business on a particular day.
   * @type {string}
   */
  closes: string;
}

export interface Contact {
  /**
   * The email address.
   * @type {string}
   */
  email?: string;
  /**
   * The telephone number.
   * @type {string}
   */
  telephone?: string;
}

export interface DataProvider {
  /**
   * The type representing the source of data. This is usually "external".
   * @type {string}
   */
  type: "external";
  /**
   * The name of the data provider. This can be a domain.
   * @type {string}
   */
  name: string;
  /**
   * The url where the information is coming from.
   * @type {string}
   */
  url: string;
  /**
   * The long name for the data provider.
   * @type {string}
   */
  long_name?: string;
  /**
   * The served url for the image data.
   * @type {string}
   */
  img?: string;
}

export interface Reviews {
  /**
   * A list of trip advisor reviews for the entity.
   * @type {TripAdvisorReview[]}
   */
  results: TripAdvisorReview[];
  /**
   * A url to a web page where more information on the result can be seen.
   * @type {string}
   */
  viewMoreUrl: string;
  /**
   * Any reviews available in a foreign language.
   * @type {boolean}
   */
  reviews_in_foreign_language: boolean;
}

export interface TripAdvisorReview {
  /**
   * The title of the review.
   * @type {string}
   */
  title: string;
  /**
   * A description seen in the review.
   * @type {string}
   */
  description: string;
  /**
   * The date when the review was published.
   * @type {string}
   */
  date: string;
  /**
   * A rating given by the reviewer.
   * @type {Rating}
   */
  rating: Rating;
  /**
   * The author of the review.
   * @type {Person}
   */
  author: Person;
  /**
   * A url link to the page where the review can be found.
   * @type {string}
   */
  review_url: string;
  /**
   * The language of the review.
   * @type {string}
   */
  language: string;
}

export interface PictureResults {
  /**
   * A url to view more pictures.
   * @type {string}
   */
  viewMoreUrl: string;
  /**
   * A list of thumbnail results.
   * @type {Thumbnail[]}
   */
  results: Thumbnail[];
}

export interface Action {
  /**
   * The type representing the action.
   * @type {string}
   */
  type: string;
  /**
   * A url representing the action to be taken.
   * @type {string}
   */
  url: string;
}

export interface LocationWebResult extends Result {
  /**
   * Aggregated information about the url.
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
}

export interface SummaryMessage {
  /**
   * The type of subset of a summary message. The value can be "token" (a text excerpt from the summary), "enum_item" (a summary entity), "enum_start" (describes the beginning of summary entities, which means the following item(s) in the summary list will be entities), or "enum_end" (the end of summary entities).
   * @type {string}
   */
  type: "token" | "enum_item" | "enum_start" | "enum_end";
  /**
   * The summary entity or the explanation for the type field. For type "enum_start" the value can be "ol" or "ul", which means an ordered list or an unordered list of entities follows respectively. For type "enum_end" there is no value. For type "token" the value is a text excerpt. For type "enum_item" the value is the SummaryEntity response model.
   * @type {SummaryEntity | string}
   */
  data: SummaryEntity | string;
}

export interface SummaryEntity {
  /**
   * A unique identifier for the entity.
   * @type {string}
   */
  uuid: string;
  /**
   * The name of the entity.
   * @type {string}
   */
  name: string;
  /**
   * The url where further details on the entity can be found.
   * @type {string}
   */
  url: string;
  /**
   * A text message describing the entity.
   * @type {string}
   */
  text: string;
  /**
   * The image associated with the entity.
   * @type {SummaryImage[]}
   */
  images: SummaryImage[];
  /**
   * The location of the entity in the summary message.
   * @type {TextLocation[]}
   */
  highlight: TextLocation[];
}

export interface SummaryImage extends Image {
  /**
   * Text associated with the image.
   * @type {string}
   */
  text: string;
}

export interface SummaryEnrichments {
  /**
   * The raw summary message.
   * @type {string}
   */
  raw: string;
  /**
   * The images associated with the summary.
   * @type {SummaryImage[]}
   */
  images: SummaryImage[];
  /**
   * The answers in the summary message.
   * @type {SummaryAnswer[]}
   */
  qa: SummaryAnswer[];
  /**
   * The entities in the summary message.
   * @type {SummaryEntity[]}
   */
  entities: SummaryEntity[];
  /**
   * References based on which the summary was built.
   * @type {SummaryContext[]}
   */
  context: SummaryContext[];
}

export interface SummaryAnswer {
  /**
   * The answer text.
   * @type {string}
   */
  answer: string;
  /**
   * A score associated with the answer.
   * @type {number}
   */
  score: number;
  /**
   * The location of the answer in the summary message.
   * @type {TextLocation}
   */
  highlight: TextLocation;
}

export interface SummaryContext {
  /**
   * The title of the reference.
   * @type {string}
   */
  title: string;
  /**
   * The url where the reference can be found.
   * @type {string}
   */
  url: string;
  /**
   * Details on the url associated with the reference.
   * @type {MetaUrl}
   */
  meta_url: MetaUrl;
}

export interface SummaryEntityInfo {
  /**
   * The name of the provider.
   * @type {string}
   */
  provider: string;
  /**
   * Description of the entity.
   * @type {string}
   */
  description: string;
}

export interface TextLocation {
  /**
   * The 0 based index, where the important part of the text starts.
   * @type {number}
   */
  start: number;
  /**
   * The 0 based index, where the important part of the text ends.
   * @type {number}
   */
  end: number;
}

// Additional types that might be useful

export interface Language {
  /**
   * The main language seen in the string.
   * @type {string}
   */
  main: string;
  // Add any other properties related to language if needed
}

export interface DeepResult {
  /**
   * A list of news results associated with the result.
   * @type {NewsResult[]}
   */
  news?: NewsResult[];
  /**
   * A list of buttoned results associated with the result.
   * @type {ButtonResult[]}
   */
  buttons?: ButtonResult[];
  /**
   * Social profile associated with the result.
   * @type {KnowledgeGraphProfile[]}
   */
  social?: KnowledgeGraphProfile[];
  /**
   * Videos associated with the result.
   * @type {VideoResult[]}
   */
  videos?: VideoResult[];
  /**
   * Images associated with the result.
   * @type {Image[]}
   */
  images?: Image[];
}

export interface ButtonResult {
  /**
   * A type identifying button result. The value is always "button_result".
   * @type {string}
   */
  type: "button_result";
  /**
   * The title of the result.
   * @type {string}
   */
  title: string;
  /**
   * The url for the button result.
   * @type {string}
   */
  url: string;
}

export interface KnowledgeGraphProfile {
  /**
   * A short title describing the entity.
   * @type {string}
   */
  title: string;
  /**
   * A description of the entity.
   * @type {string}
   */
  description: string;
  /**
   * The url representing the profile.
   * @type {string}
   */
  url: string;
  /**
   * The thumbnail associated with the profile.
   * @type {string}
   */
  thumbnail: string;
}

export interface Image {
  /**
   * The thumbnail associated with the image.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The url of the image.
   * @type {string}
   */
  url: string;
  /**
   * Metadata on the image.
   * @type {ImageProperties}
   */
  properties: ImageProperties;
}

// Utility types

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Nullable<T> = { [K in keyof T]: T[K] | null };

// Enums

export enum SafeSearchLevel {
  Off = "off",
  Moderate = "moderate",
  Strict = "strict",
}

export enum FreshnessOption {
  PastDay = "pd",
  PastWeek = "pw",
  PastMonth = "pm",
  PastYear = "py",
}

/**
 * Represents the freshness options for filtering search results by the time they were discovered.
 * Each option corresponds to a specific time delta. Additionally, a date range can be specified.
 *
 * For more detailed information, refer to the [Brave Search API Documentation](https://api.search.brave.com/app/documentation/web-search/query).
 *
 * @example
 * FreshnessOption.PastDay // Filters results discovered within the last 24 hours.
 * FreshnessOption.PastWeek // Filters results discovered within the last 7 days.
 * "2022-04-01to2022-07-30" // Filters results discovered within the specified date range.
 */
export type Freshness = FreshnessOption | string;

export enum UnitSystem {
  Metric = "metric",
  Imperial = "imperial",
}
// Additional types that might be useful

export interface Language {
  /**
   * The main language seen in the string.
   * @type {string}
   */
  main: string;
  // Add any other properties related to language if needed
}

export interface DeepResult {
  /**
   * A list of news results associated with the result.
   * @type {NewsResult[]}
   */
  news?: NewsResult[];
  /**
   * A list of buttoned results associated with the result.
   * @type {ButtonResult[]}
   */
  buttons?: ButtonResult[];
  /**
   * Social profile associated with the result.
   * @type {KnowledgeGraphProfile[]}
   */
  social?: KnowledgeGraphProfile[];
  /**
   * Videos associated with the result.
   * @type {VideoResult[]}
   */
  videos?: VideoResult[];
  /**
   * Images associated with the result.
   * @type {Image[]}
   */
  images?: Image[];
}

export interface ButtonResult {
  /**
   * A type identifying button result. The value is always "button_result".
   * @type {string}
   */
  type: "button_result";
  /**
   * The title of the result.
   * @type {string}
   */
  title: string;
  /**
   * The url for the button result.
   * @type {string}
   */
  url: string;
}

export interface KnowledgeGraphProfile {
  /**
   * A short title describing the entity.
   * @type {string}
   */
  title: string;
  /**
   * A description of the entity.
   * @type {string}
   */
  description: string;
  /**
   * The url representing the profile.
   * @type {string}
   */
  url: string;
  /**
   * The thumbnail associated with the profile.
   * @type {string}
   */
  thumbnail: string;
}

export interface Image {
  /**
   * The thumbnail associated with the image.
   * @type {Thumbnail}
   */
  thumbnail: Thumbnail;
  /**
   * The url of the image.
   * @type {string}
   */
  url: string;
  /**
   * Metadata on the image.
   * @type {ImageProperties}
   */
  properties: ImageProperties;
}

  /**
   * Options for image search
   * 
   * https://api-dashboard.search.brave.com/app/documentation/image-search/query
   */
  export interface ImageSearchOptions extends Pick<BraveSearchOptions, 'country' | 'search_lang' | 'safesearch' | 'spellcheck' | 'count'> {
  }

  /**
   * Response from the Brave Search API for an Image search
   * 
   * https://api-dashboard.search.brave.com/app/documentation/image-search/responses
   */
  export interface ImageSearchApiResponse {
    /**
     * The type of search API result. The value is always images.
     * @type {string}
     */
    type: 'images'
    /**
     * Image search query string.
     * @type {Query}
     */
    query: Query
    /**
     * The list of image results for the given query.
     * @type {ImageResult[]}
     */
    results: ImageResult[]
  }

  /**
   * A model representing an image result for the requested query.
   * 
   * https://api-dashboard.search.brave.com/app/documentation/image-search/responses#ImageResult
   */
  export interface ImageResult {
    /**
     * The type of image search API result. The value is always image_result.
     * @type {string}
     */
    type: 'image_result'
    /**
     * The title of the image.
     * @type {string} 
     */
    title: string
    /**
     * The original page url where the image was found.
     * @type {string}
     */
    url: string
    /**
     * The source domain where the image was found.
     * @type {string}
     */
    source: string
    /**
     * The iso date time when the page was last fetched. The format is YYYY-MM-DDTHH:MM:SSZ
     * @type {string}
     */
    page_fetched: string
    /**
     * The thumbnail for the image.
     * @type {Thumbnail}
     */
    thumbnail: Thumbnail
    /**
     * Metadata for the image
     * @type {Properties}
     */
    properties: Properties
    /**
     * Aggregated information on the url associated with the image search result.
     * @type {MetaUrl}
     */
    meta_url: MetaUrl
  }

  /**
   * Metadata on an image.
   * 
   * https://api-dashboard.search.brave.com/app/documentation/image-search/responses#Properties
   */
  export interface Properties {
    /**
     * The image URL.
     * @type {string}
     */
    url: string
    /**
     * The lower resolution placeholder image url.
     * @type {string}
     */
    placeholder: string
  }

  /**
   * Options for news search
   * 
   * https://api-dashboard.search.brave.com/app/documentation/news-search/query
   */
  export interface NewsSearchOptions extends Pick<BraveSearchOptions, 'country' | 'search_lang' | 'ui_lang' | 'count' | 'offset' | 'spellcheck' | 'safesearch' | 'freshness' | 'extra_snippets'> {
  }

  /**
   * Response from the Brave Search API for a News search
   * 
   * https://api-dashboard.search.brave.com/app/documentation/news-search/responses#NewsSearchApiResponse
   */
  export interface NewsSearchApiResponse {
    /**
     * The type of search API result. The value is always news.
     * @type {string}
     */
    type: 'news'
    /**
     * 	News search query string.
     * * @type {Query}
     */
    query: Query
    /**
     * The list of news results for the given query.
     * @type {NewsResult[]}
     */
    results: NewsResult[]
  }