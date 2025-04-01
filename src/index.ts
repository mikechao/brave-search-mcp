import { BraveSearch } from "brave-search";
import { imageContent } from "fastmcp";
import { SafeSearchLevel } from "brave-search/dist/types.js";
import { FastMCP } from "fastmcp";
import { z } from "zod";

const server = new FastMCP({
  name: "Better Brave Search",
  version: "1.0.0",
})

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

const braveSearch = new BraveSearch(BRAVE_API_KEY)

server.addTool({
  name: "brave_image_search",
  description: "Search for images using Brave Search",
  parameters: z.object({
    searchTerm: z.string().describe("The term to search the internet for images of"),
    count: z.number().min(1).max(6).default(1).describe("The number of images to search for"),
  }),
  execute: async (input) => {
    const { searchTerm, count } = input;
    const imageResults = await braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict
    })
    const content = []
    for (const result of imageResults.results) {
      content.push(await imageContent({ url: result.properties.url}))
    } 
    return { content }
  }
})

server.start({
  transportType: "stdio"
})