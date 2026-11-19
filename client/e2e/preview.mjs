import { preview } from 'vite'

await preview({
  preview: {
    host: '127.0.0.1',
    port: 5187,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:5127' },
  },
})
