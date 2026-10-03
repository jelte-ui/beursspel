import { getStore } from '@netlify/blobs';
export default async () => {
  const hist = (await getStore('beursspel').get('hist', { type: 'json' })) || {};
  return new Response(JSON.stringify(hist), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=20' } });
};
export const config = { path: '/api/quotes' };
