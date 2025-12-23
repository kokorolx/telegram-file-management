export default function sitemap() {
  const baseUrl = 'https://files.thnkandgrow.com';

  const routes = [
    '',
    '/landing',
    '/pricing',
    '/roadmap',
    '/changelog',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));

  return routes;
}
