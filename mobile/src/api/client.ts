import { API_BASE_URL } from './config';
import { ApiOffer, BrandsResponse, OffersResponse } from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchBrands(): Promise<BrandsResponse> {
  return get<BrandsResponse>('/brands');
}

export function fetchOffers(): Promise<OffersResponse> {
  return get<OffersResponse>('/offers');
}

export function fetchOffer(id: number | string): Promise<ApiOffer> {
  return get<ApiOffer>(`/offers/${id}`);
}
