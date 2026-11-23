import { setupServer } from 'msw/node'

// Tests add their own handlers; unexpected requests fail instead of reaching a backend.
export const server = setupServer()
