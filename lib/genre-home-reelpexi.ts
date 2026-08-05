import { getGenreRowsForHome } from './api';

export async function getGenreRowsForHomeReelpexi(limit = 12) {
  return await getGenreRowsForHome(limit);
}
