/**
 * Helper functions for metadata customization
 */

/**
 * Add authentication headers to requests
 */
export const withAuth = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

/**
 * Add cache control headers
 */
export const withCache = (maxAge: number) => ({
  headers: {
    "Cache-Control": `max-age=${maxAge}`,
  },
});
