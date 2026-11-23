import { Test } from '@nestjs/testing';
import { CoreModule } from './core.module.js';
import { RedisService } from '../common/redis/redis.service.js';

describe('CoreModule', () => {
  it('resolves its global providers from application config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule],
    })
      .overrideProvider(RedisService)
      .useValue({ duplicateClient: () => ({ isOpen: false }) })
      .compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  }, 30000);
});
