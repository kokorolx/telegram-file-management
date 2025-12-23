export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/settings/',
          '/?login=true',
        ],
      },
    ],
    sitemap: 'https://files.thnkandgrow.com/sitemap.xml',
  }
}
