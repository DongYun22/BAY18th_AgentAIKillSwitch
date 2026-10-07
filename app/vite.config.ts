import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    env: {
      VITE_FROM_BLOCK: '1',
    },
    reporters: ['verbose'],
  },
})
