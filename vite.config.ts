import react from '@vitejs/plugin-react'

export default {
  plugins: [react()],
  build: {
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'privy': ['@privy-io/react-auth'],
          'blockchain': ['ethers', '@ethereum-attestation-service/eas-sdk-v2'],
        }
      }
    }
  }
}
