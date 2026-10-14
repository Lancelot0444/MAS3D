import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MAS3D Manager',
    short_name: 'MAS3D',
    description: 'Pedidos, clientes y finanzas de MAS3D',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf9',
    theme_color: '#fbf4ea',
    lang: 'es-EC',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
