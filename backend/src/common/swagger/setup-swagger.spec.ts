import 'reflect-metadata';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { parse } from 'yaml';
import { AppController } from '../../app.controller.js';
import { AuthController } from '../../auth/auth.controller.js';
import { PUBLIC_ROUTE } from '../../auth/decorators/auth.decorators.js';
import { loadOpenApiDocument, setupSwagger } from './setup-swagger.js';

describe('module OpenAPI documents', () => {
  const document = loadOpenApiDocument();

  it('validates the combined document against the OpenAPI schema', async () => {
    const api = structuredClone(document) as SwaggerParser['api'];
    await expect(
      SwaggerParser.validate(api, { resolve: { external: false } }),
    ).resolves.toHaveProperty('openapi', '3.0.3');
  });

  it('documents every controller route with the correct status and bearer policy', () => {
    const routes: string[] = [];
    const documented: string[] = [];
    for (const controller of [AppController, AuthController]) {
      const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = Object.getOwnPropertyDescriptor(
          controller.prototype,
          name,
        )?.value as object | undefined;
        if (!handler) continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (method === undefined) continue;
        const suffix = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const path =
          `/${[prefix, suffix].filter((part) => part && part !== '/').join('/')}`.replace(
            /:([^/]+)/g,
            '{$1}',
          );
        const verb = RequestMethod[method].toLowerCase() as
          'get' | 'post' | 'delete';
        const operation = document.paths[path]?.[verb];
        expect(operation, `${verb} ${path}`).toBeDefined();
        const status = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as
          number | undefined;
        expect(
          operation!.responses[String(status ?? (verb === 'post' ? 201 : 200))],
        ).toBeDefined();
        const isPublic = Reflect.getMetadata(PUBLIC_ROUTE, handler) as
          boolean | undefined;
        expect(
          operation!.security?.some((security) => 'bearerAuth' in security),
        ).toBe(!isPublic);
        if (path.startsWith('/auth/') && verb !== 'get') {
          expect(operation!.parameters).toEqual(
            expect.arrayContaining([
              { $ref: '#/components/parameters/CsrfProtection' },
              { $ref: '#/components/parameters/TrustedOrigin' },
            ]),
          );
        }
        routes.push(`${verb} ${path}`);
      }
    }
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'options',
        'head',
      ] as const) {
        if (item[method]) documented.push(`${method} ${path}`);
      }
    }
    expect(documented.sort()).toEqual(routes.sort());
  });

  it('resolves every reference and expands YAML merge keys', () => {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        expect(key).not.toBe('<<');
        if (key === '$ref') {
          expect(child).toMatch(/^#\//);
          let target: unknown = document;
          for (const segment of (child as string).slice(2).split('/')) {
            target = (target as Record<string, unknown> | undefined)?.[
              segment.replace(/~1/g, '/').replace(/~0/g, '~')
            ];
          }
          expect(target, String(child)).toBeDefined();
        } else visit(child);
      }
    };
    visit(document);
    expect(
      document.paths['/auth/change-password'].post!.responses['401'],
    ).toBeDefined();
    expect(
      document.paths['/auth/reset-password'].post!.responses['400'],
    ).toBeDefined();
  });

  it('rejects duplicate definitions instead of overwriting another module', () => {
    const directory = mkdtempSync(join(tmpdir(), 'viraboard-openapi-'));
    try {
      writeFileSync(
        join(directory, 'app.openapi.yaml'),
        'openapi: 3.0.3\ninfo: {title: Test, version: 1.0.0}\npaths: { /: {} }\n',
      );
      writeFileSync(
        join(directory, 'other.openapi.yaml'),
        'paths: { /: {} }\n',
      );
      expect(() => loadOpenApiDocument(directory)).toThrow(
        'Duplicate OpenAPI definition: paths//',
      );
      writeFileSync(
        join(directory, 'other.openapi.yaml'),
        'paths: {}\ncomponents: {schemas: {User: {type: object}}}\n',
      );
      writeFileSync(
        join(directory, 'third.openapi.yaml'),
        'paths: {}\ncomponents: {schemas: {User: {type: string}}}\n',
      );
      expect(() => loadOpenApiDocument(directory)).toThrow(
        'Duplicate OpenAPI definition: components/schemas/User',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Swagger HTTP routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({}).compile();
    app = module.createNestApplication();
    app.useSecurityHeaders();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves Swagger UI and its local assets with security headers enabled', async () => {
    await request(app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect(/swagger-ui/);
    await request(app.getHttpServer())
      .get('/docs/swagger-ui-bundle.js')
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/docs/swagger-ui-init.js')
      .expect(200);
    expect(response.text).toContain('"withCredentials": true');
    expect(response.text).toContain('"persistAuthorization": false');
  });

  it('serves the same combined specification as JSON and YAML', async () => {
    const json = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);
    const yaml = await request(app.getHttpServer())
      .get('/docs/openapi.yaml')
      .expect(200);
    expect(json.body).toEqual(loadOpenApiDocument());
    expect(parse(yaml.text)).toEqual(json.body);
  });
});
