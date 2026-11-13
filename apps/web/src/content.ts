/**
 * Site content is kept in the repository's data/ folder as JSON, with images in data/images/, so it can be updated without touching
 * code. Vite serves data/ at the site root; paths inside the JSON are relative to data/ (for example "images/places/x.jpg").
 */
export const asset = (p: string) => (/^(https?:)?\//.test(p) ? p : `/${p}`);
