import { getGenreRowsForHome } from './api';

// Redirect to ReelPlexi API genre row fetcher
export async function getGenreRowsForHomeSupabase(limit = 20) {
  return await getGenreRowsForHome(limit);
}
