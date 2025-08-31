/**
 * Utility function for making consistent FPL API calls with proper headers
 * to avoid 403/500 errors in production
 */
export async function fetchFPLAPI(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  const defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Referer: "https://fantasy.premierleague.com/",
    Origin: "https://fantasy.premierleague.com",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `FPL API error for ${url}:`,
        response.status,
        response.statusText
      );

      // Retry on 5xx errors or 429 (rate limit)
      if ((response.status >= 500 || response.status === 429) && retries > 0) {
        //console.log(`Retrying request to ${url}, attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return fetchFPLAPI(url, options, retries - 1);
      }

      // Try to get error details from response
      let errorDetail = "";
      try {
        const errorData = await response.text();
        errorDetail = errorData ? ` - ${errorData}` : "";
      } catch (e) {
        // Ignore parsing errors
      }

      throw new Error(
        `HTTP ${response.status}: ${response.statusText}${errorDetail}`
      );
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Retry on network errors
    if (error.name === "AbortError") {
      throw new Error(
        "Request timeout - FPL API is taking too long to respond"
      );
    } else if (error.name === "TypeError" && retries > 0) {
      //console.log(
      //   `Network error, retrying request to ${url}, attempts left: ${retries}`
      // );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchFPLAPI(url, options, retries - 1);
    }

    throw error;
  }
}
