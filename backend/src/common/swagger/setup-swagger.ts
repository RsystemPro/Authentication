import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { parse } from 'yaml';

type ModuleDocument = Pick<OpenAPIObject, 'paths' | 'components' | 'tags'>;

function mergeUnique<T>(
  target: Record<string, T>,
  source: Record<string, T>,
  location: string,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (Object.hasOwn(target, key)) {
      throw new Error(`Duplicate OpenAPI definition: ${location}/${key}`);
    }
    target[key] = value;
  }
}

function findDocuments(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findDocuments(path);
    return entry.name.endsWith('.openapi.yaml') ? [path] : [];
  });
}

export function loadOpenApiDocument(
  sourceRoot = fileURLToPath(new URL('../../', import.meta.url)),
): OpenAPIObject {
  const rootPath = join(sourceRoot, 'app.openapi.yaml');
  const document = parse(readFileSync(rootPath, 'utf8'), {
    merge: true,
  }) as OpenAPIObject;
  const components = (document.components ??= {}) as Record<
    string,
    Record<string, unknown>
  >;

  for (const path of findDocuments(sourceRoot).sort()) {
    if (path === rootPath) continue;
    const fragment = parse(readFileSync(path, 'utf8'), {
      merge: true,
    }) as ModuleDocument;
    mergeUnique(document.paths, fragment.paths, 'paths');
    for (const [kind, definitions] of Object.entries(
      fragment.components ?? {},
    )) {
      mergeUnique((components[kind] ??= {}), definitions, `components/${kind}`);
    }
    document.tags = [...(document.tags ?? []), ...(fragment.tags ?? [])];
  }
  return document;
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, loadOpenApiDocument(), {
    jsonDocumentUrl: 'docs/openapi.json',
    yamlDocumentUrl: 'docs/openapi.yaml',
    customSiteTitle: 'ViraBoard API',
    swaggerOptions: {
      withCredentials: true,
      persistAuthorization: false,
    },
  });
}
