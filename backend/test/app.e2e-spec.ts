import { createAuthTestApps } from './auth-test-app.js';
import type { AuthTestContext } from './auth-test-app.js';

describe('AppController (e2e)', () => {
  let context: AuthTestContext;

  beforeAll(async () => {
    context = await createAuthTestApps();
  }, 60000);

  it('/ (GET)', () => {
    return context.client().get('/').expect(200).expect('Hello World!');
  });

  afterAll(async () => {
    if (context) await context.close();
  });
});
