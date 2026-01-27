import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to proxy Brave Search API requests
 * This keeps the API key secure on the backend
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, count = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      console.error("BRAVE_SEARCH_API_KEY is not set in environment variables");
      return NextResponse.json(
        { 
          success: false,
          error: "Brave Search API key not configured. Please set BRAVE_SEARCH_API_KEY in your .env file." 
        },
        { status: 500 }
      );
    }

    // Call Brave Search API
    const searchParams = new URLSearchParams({
      q: query,
      count: Math.min(Math.max(count, 1), 20).toString(), // Clamp between 1 and 20
    });

    const braveResponse = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!braveResponse.ok) {
      const errorText = await braveResponse.text();
      console.error('Brave Search API error:', braveResponse.status, errorText);
      
      return NextResponse.json(
        { 
          success: false,
          error: `Brave Search API error: ${braveResponse.status} - ${errorText}` 
        },
        { status: braveResponse.status }
      );
    }

    const braveData = await braveResponse.json();

    // Extract and format results
    const results = (braveData.web?.results || []).map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      description: result.description || result.snippet || '',
      snippet: result.snippet || result.description || '',
    }));

    return NextResponse.json({
      success: true,
      query: query,
      resultsCount: results.length,
      results: results,
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error while performing search' 
      },
      { status: 500 }
    );
  }
}
